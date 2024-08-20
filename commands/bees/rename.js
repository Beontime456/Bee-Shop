const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// Initialise all functions and required tables from universal module
const {
    playerinformation,
    playerbees,
    beeFact,
    checkNameCompliance,
    interactionAuthFunc,
    requestBeeFunc,
} = require('C:/Bee Shop/universalmodule.js');

playerinformation.sync();
playerbees.sync();

// Profanity filter
const profanities = ['dick', 'sex', 'cum', 'porn', 'nude', 'hentai', 'fap', 'boobs', 'cummed', 'ballsack', 'cumming', 'fapped', 'fapping', 'vagina', 'erotica', 'fingering', 'g-spot', 'kock', 'vaginal', 'oral', 'titty', 'gore', 'anal', 'blowjob', 'handjob', 'boob', 'butthole', 'cocks', 'cumshot', 'cumshots', 'cunnilingus', 'dildo', 'doggystyle', 'nigga', 'nigger', 'bitches', 'rape', 'semen', 'testicles', 'titties', 'penis', 'creampie', 'onlyfans', 'faggot', 'cp', 'milf', 'r34', 'rule34', 'seduce', 'lewd', 'coems', 'cock', 'boner', 'ph', 'pornhub', 'slut', 'Whore', 'faggot', 'jack off', 'jacking off', 'orgasm', 'orgy', 'yiff', 'yaoi', 'smegma', 'condom', 'prick', 'urethra', 'bollocks', 'deepthroat', 'fornicating', 'erection', 'kink', 'hitler', '9/11', 'cunt', 'nazi', 'bukkake', 'fuck', 'fucking', 'shit', 'shitting', 'fucks', 'shits' ];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rename')
		.setDescription('Give one of your bees a different name.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the bee you want to rename')
                .setRequired(true)
                .setAutocomplete(true),
        ),
    async autocomplete(interaction) {
        // Autocomplete will show a series of results from both the items and bees tables depending on what you type in the name arg. Only through slash.
        const focusedOption = interaction.options.getFocused(true);
        const choices = [];
        const allBees = await playerbees.findAll({ where: { playerid: interaction.user.id } });
        for (let count = 0; count < allBees.length; count++) {
            choices.push(allBees[count].dataValues.beeName);
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
            options.map(choice => ({ name: choice, value: choice })),
        );
    },
	async execute(interaction, isSlash, args) {
        // Determine command execution type and therefore where arguments are stored
        const requestbee = await requestBeeFunc(isSlash, interaction, args);
        const interactionAuth = await interactionAuthFunc(isSlash, interaction);
        // Find the player and check if the bee they are trying to buy is in the shop or even exists
        const findBee = await playerbees.findOne({ where: { beeName: requestbee } });
        if (findBee === null) { return await interaction.reply('You don\'t have a bee named this!'); }
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
            .addFields({ name: `Are you sure you want to rename ${requestbee}?`, value: 'Renaming a bee is free.' });
        const confirmMessage = await interaction.reply({ embeds: [confirmembed], components: [row] });
        const collectorFilter2 = i => {
            return i.user.id === interactionAuth.id;
        };
        await confirmMessage.awaitMessageComponent({ filter: collectorFilter2, time: 15000 })
        // What happens when a button press makes it past the filter
        .then(async j => {
            if (j.customId === 'confirm') {
                // If they have the bee, prompt them to rename their bee, and compare it to the player's other bees and their names.
                const nameModal = new ModalBuilder()
                    .setCustomId('nameModal')
                    .setTitle('What are you going to rename your bee?');
                // Create the text input components
                const beeNameInput = new TextInputBuilder()
                    .setCustomId('beeName')
                    .setLabel('What do you want to rename your bee?')
                    .setMaxLength(20)
                    .setPlaceholder('Enter your bee\'s new name here!')
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
                    if (i.fields.getTextInputValue('beeName') === requestbee) { return i.followUp('Your bee is already named this!'); }
                    const findplayerbees = await playerbees.findOne({ where: { playerid: interactionAuth.id, beeName: i.fields.getTextInputValue('beeName') } });
                    if (findplayerbees) { return i.followUp('This name is already taken by another one of your bees!'); }
                    i.followUp(`Renamed ${findBee.get('beeName')} to ${i.fields.getTextInputValue('beeName')}!`);
                    await findBee.update({
                        beeName: i.fields.getTextInputValue('beeName'),
                    });
                })
                .catch(async () => {
                    await j.followUp('You decided not to rename your bee.');
                });
            }
            else if (j.customId === 'deny') {
                confirmMessage.edit({ components: [], embeds: [], content: 'You decided not to rename your bee.' });
            }
        });
    },
};