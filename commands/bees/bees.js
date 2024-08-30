// Use required dependencies in the command
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Initialise all functions and required tables from universal module
const {
    playerinformation,
    playerbees,
    beelist,
    beeFact,
    capitaliseWords,
    increaseTypeSuffixMap,
    calculateBeeIncrease,
    interactionAuthFunc,
    requestPlayerFunc,
} = require('C:/Bee Shop/universalmodule.js');

playerinformation.sync();
playerbees.sync();
beelist.sync();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bees')
		.setDescription('Check out your bees')
        .addUserOption(option => option.setName('user').setDescription('Check another player\'s bees')),
        async execute(responseMethod, interaction, args, client) {
            try {
                // Determine command execution type and therefore where arguments are stored
                const interactionAuth = await interactionAuthFunc(interaction);
                const requestplayer = await requestPlayerFunc(interaction, args, client, interactionAuth);

                // Find out if the player specified has started and retrieve all bees the player owns.
                const findPlayerBees = await playerbees.findAll({ where: { playerid: requestplayer.id } });
                const findTarget = await playerinformation.findOne({ where: { playerid: requestplayer.id } });

                // If the player found has no bees
                if (findPlayerBees.length === 0) {
                    await responseMethod('This player has no bees!');
                    return;
                }

                // Map all the owned bee's ids and find the info of all the bees using this map
                const beeIds = findPlayerBees.map(bee => bee.dataValues.beeid);
                const findPlayerBeeInfo = await beelist.findAll({ where: { beeid: beeIds } });

                // Begin constructing "pages" for the bee embed, assuming 6 bees will fit on an embed
                const pages = [];
                const beesPerPage = 6;
                for (let i = 0; i < findPlayerBees.length; i += beesPerPage) {
                    // Get the next 6 bees to put on a page.
                    // Initialise an array to store the relevant information to display
                    const beesOnPage = findPlayerBees.slice(i, i + beesPerPage);
                    const beeFields = [];

                    // For each bee on the page, retrieve it's information and find out how powerful it is (includes determining what it increases and by how much)
                    for (const bee of beesOnPage) {
                        const beeInfo = findPlayerBeeInfo.find(beeType => beeType.beeid === bee.get('beeid'));
                        const beeIncrease = await calculateBeeIncrease(bee, beeInfo, true);
                        const suffix = increaseTypeSuffixMap[beeInfo.get('increaseType')];

                        // Put all the required information into an object which is then pushed to beeFields
                        beeFields.push({
                            name: `**${bee.get('beeName')}**`,
                            value: `Species: ${capitaliseWords(beeInfo.get('beeName'))} \nLevel: ${bee.get('beeLevel')}/${Math.floor(beeInfo.get('levelCapMultiplier') * 10 * (0.1 * findTarget.get('prestiges') + 1))} \nIncrease: ${beeIncrease} ${suffix}`,
                            inline: true,
                        });
                    }

                    // This constructs a page by putting the usual stuff in the embed and then adding the bees for this particular page.
                    const beeembed = new EmbedBuilder()
                        .setColor(0xffe521)
                        .setAuthor({ name: `${capitaliseWords(requestplayer.username)}'s bees`, iconURL: requestplayer.displayAvatarURL() })
                        .setFooter({ text: beeFact() })
                        .addFields({ name: 'Bees', value: `These are all your bees. \nNames for bees are nicknames you can give to bees. These names must be unique compared to your other bee's names.  \n\nBee slots: ${await playerbees.count({ where: { playerid: requestplayer.id } })}/${findTarget.get('beeSlots')}` })
                        .addFields(beeFields);
                    // Push the now completed page to the original pages array.
                    pages.push(beeembed);
                }

                // Sets the current page, using let because this is how we change the page
                let currentPage = 0;
                // Generate buttons for the user to press that cycle pages
                const row = new ActionRowBuilder()
                    .addComponents([
                        new ButtonBuilder().setCustomId('firstPage').setStyle(ButtonStyle.Secondary).setEmoji('⏪'),
                        new ButtonBuilder().setCustomId('prevPage').setStyle(ButtonStyle.Secondary).setEmoji('◀️'),
                        new ButtonBuilder().setCustomId('nextPage').setStyle(ButtonStyle.Secondary).setEmoji('▶️'),
                        new ButtonBuilder().setCustomId('lastPage').setStyle(ButtonStyle.Secondary).setEmoji('⏩'),
                    ]);

                // Create the message to be sent to the user, and determine if the buttons are even needed
                const embedMessage = await responseMethod({ embeds: [pages[currentPage]], components: pages.length > 1 ? [row] : [] });
                // If there is more than one page, create a button collector that will listen for a button press and fire an action
                // The collector will stay on for 90 seconds, and will remove the buttons once these 90 seconds have passed.
                if (pages.length > 1) {
                    const collector = embedMessage.createMessageComponentCollector({ time: 90000 });
                    collector.on('collect', async i => {
                        // Check if the command executor is the one running the command
                        if (i.user.id === interactionAuth.id) {
                            // Only reason this is here is because I couldn't get the button to not say a response was not outputted despite there being one anyways
                            // Damn Discord's API limitations.
                            if (!i.deferred) await i.deferUpdate();
                            switch (i.customId) {
                                // Read which button was pressed and act accordingly.
                                // prevPage and nextPage WILL cycle back to the end/start pages if they leave the bounds of the array.
                                case 'firstPage': currentPage = 0; break;
                                case 'prevPage': currentPage = (currentPage - 1 + pages.length) % pages.length; break;
                                case 'nextPage': currentPage = (currentPage + 1) % pages.length; break;
                                case 'lastPage': currentPage = pages.length - 1; break;
                            }
                            await i.editReply({ embeds: [pages[currentPage]], components: [row] });
                        }
                    });

                    // Button disabler.
                    collector.on('end', () => embedMessage.edit({ components: [] }));
                }
            }
            catch (error) {
                // You can never be too safe.
                // Best have an error come out rather than have the entire bot/shard go down.
                console.error(error);
                await responseMethod(`There was an error: ${error.message}`);
            }
        },
};