// Required dependencies
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Initialise all functions and required tables from universal module
const {
    playerinformation,
    playerbees,
    beelist,
    beeFact,
    checkNameCompliance,
    capitaliseWords,
    interactionAuthFunc,
    requestBeeFunc,
} = require('C:/Bee Shop/universalmodule.js');

playerinformation.sync();
playerbees.sync();
beelist.sync();

// Profanity filter
const profanities = ['dick', 'sex', 'cum', 'porn', 'nude', 'hentai', 'fap', 'boobs', 'cummed', 'ballsack', 'cumming', 'fapped', 'fapping', 'vagina', 'erotica', 'fingering', 'g-spot', 'kock', 'vaginal', 'oral', 'titty', 'gore', 'anal', 'blowjob', 'handjob', 'boob', 'butthole', 'cocks', 'cumshot', 'cumshots', 'cunnilingus', 'dildo', 'doggystyle', 'nigga', 'nigger', 'bitches', 'rape', 'semen', 'testicles', 'titties', 'penis', 'creampie', 'onlyfans', 'faggot', 'cp', 'milf', 'r34', 'rule34', 'seduce', 'lewd', 'coems', 'cock', 'boner', 'ph', 'pornhub', 'slut', 'Whore', 'faggot', 'jack off', 'jacking off', 'orgasm', 'orgy', 'yiff', 'yaoi', 'smegma', 'condom', 'prick', 'urethra', 'bollocks', 'deepthroat', 'fornicating', 'erection', 'kink', 'hitler', '9/11', 'cunt', 'nazi', 'bukkake', 'fuck', 'fucking', 'shit', 'shitting', 'fucks', 'shits', 'retard'];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('buy')
		.setDescription('Buy a bee from the shop')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The bee you want to buy')
                .setRequired(true)
                .setAutocomplete(true),
        ),
    async autocomplete(interaction) {
        // Autocomplete will show a series of results from both the items and bees tables depending on what you type in the name arg. Only through slash.
        const focusedOption = interaction.options.getFocused(true);
        const choices = [];
        const shopChoices = await beelist.findAll({ where: { findType: 'shop' } });
        for (let count = 0; count < shopChoices.length; count++) {
            const findItems = await beelist.findOne({ where: { beeid: shopChoices[count].dataValues.beeid } });
            choices.push(findItems.get('beeName'));
        }

        // Filters the options and feeds them to Discord to feed the player.
        const filtered = choices.filter(choice => choice.startsWith(focusedOption.value.toLowerCase()));
        let options;
        if (filtered.length > 25) {
            options = filtered.slice(0, 25);
        }
        else {
            options = filtered;
        }
        await interaction.respond(
            options.map(choice => ({ name: capitaliseWords(choice), value: choice })),
        );
    },
	async execute(responseMethod, interaction, isSlash, args) {
        // Determine command execution type and therefore where arguments are stored
        const interactionAuth = await interactionAuthFunc(isSlash, interaction);
        const requestbee = await requestBeeFunc(isSlash, interaction, args);
        // Find the player and check if the bee they are trying to buy is in the shop or even exists
        const findplayer = await playerinformation.findOne({ where: { playerid: interactionAuth.id } });
        const findBee = await beelist.findOne({ where: { beeName: requestbee.toLowerCase() } });
        if (findBee === null) { return responseMethod('This isn\'t a buyable kind of bee!'); }
        if (findplayer.get('money') < findBee.get('beePrice')) { return responseMethod('You are too poor lmao'); }
        if (findplayer.get('beeSlots') < await playerbees.count({ where: { playerid: interactionAuth.id } })) { return responseMethod('You don\'t have enough bee slots for this many bees!'); }
        if (findplayer.get('prestiges') < findBee.get('prestigeReq')) { return responseMethod('You don\'t have enough prestiges to buy this bee!'); }
        const row = new ActionRowBuilder()
            .addComponents([
                new ButtonBuilder()
                    .setCustomId('confirm')
                    .setLabel('Yes')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('deny')
                    .setLabel('No')
                    .setStyle(ButtonStyle.Danger),
            ]);
        const confirmembed = new EmbedBuilder()
            .setColor(0xffe521)
            .setAuthor({ name: `${interactionAuth.displayName}`, iconURL: interactionAuth.displayAvatarURL() })
            .setFooter({ text: beeFact() })
            .addFields({ name: `Are you sure you want to buy a ${capitaliseWords(requestbee)}?`, value: `Buying this bee costs ${findBee.get('beePrice')} money.` });
        const confirmMessage = await responseMethod({ embeds: [confirmembed], components: [row] });
        const collectorFilter2 = i => {
            return i.user.id === interactionAuth.id;
        };
        await confirmMessage.awaitMessageComponent({ filter: collectorFilter2, time: 15000 })
        // What happens when a button press makes it past the filter
        .then(async j => {
            if (j.customId === 'confirm') {
                // If they have the money, prompt them to give the bee a name, and compare it to the player's other bees and their names.
                const nameModal = new ModalBuilder()
                    .setCustomId('nameModal')
                    .setTitle('What are you going to name your bee?');
                // Create the text input components
                const beeNameInput = new TextInputBuilder()
                    .setCustomId('beeName')
                    .setLabel('What do you want to name your bee?')
                    .setMaxLength(20)
                    .setPlaceholder('Enter your bee name here!')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                const textInputActionRow = new ActionRowBuilder().addComponents(beeNameInput);
                nameModal.addComponents(textInputActionRow);
                await j.showModal(nameModal);
                const collectorFilter = (i) => i.customId === 'nameModal';
                j.awaitModalSubmit({ filter: collectorFilter, time: 30000, max: 1, errors: ['time'] })
                .then(async (i) => {
                    await i.deferReply();
                    if (profanities.some((value) => i.fields.getTextInputValue('beeName').includes(value))) { return i.followUp('This name contains blacklisted words.'); }
                    if (!checkNameCompliance(i.fields.getTextInputValue('beeName'))) { return i.followUp('This name contains bad characters. Choose a different name.'); }
                    const findplayerbees = await playerbees.findOne({ where: { playerid: interactionAuth.id, beeName: i.fields.getTextInputValue('beeName') } });
                    if (findplayerbees) { return i.followUp('This name is already taken by another one of your bees!'); }
                    await i.followUp(`Bought a ${capitaliseWords(findBee.get('beeName'))} named ${i.fields.getTextInputValue('beeName')} for ${findBee.get('beePrice')} money!`);
                    await findplayer.update({ money: findplayer.get('money') - findBee.get('beePrice') });
                    await playerbees.create({
                        playerid: interactionAuth.id,
                        beeid: findBee.get('beeid'),
                        beeLevel: 0,
                        beeName: i.fields.getTextInputValue('beeName'),
                    });
                })
                .catch(async () => {
                    await j.followUp('You decided not to buy a bee.');
                });
            }
            else if (j.customId === 'deny') {
                confirmMessage.edit({ components: [], embeds: [], content: 'You decided not to buy a bee.' });
            }
        })
        // What happens if the collector receives no button press that makes it past the filter
        .catch((error) => {
            console.log(error);
            row.components.forEach(button => button.setDisabled(true));
            confirmMessage.edit({ components: [row] });
        });
    },
};