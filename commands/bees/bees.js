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
        async execute(responseMethod, interaction, isSlash, args, client) {
            try {
                const interactionAuth = await interactionAuthFunc(isSlash, interaction);
                const requestplayer = await requestPlayerFunc(isSlash, interaction, args, client, interactionAuth);

                const findPlayerBees = await playerbees.findAll({ where: { playerid: requestplayer.id } });
                const findTarget = await playerinformation.findOne({ where: { playerid: requestplayer.id } });

                if (findPlayerBees.length === 0) {
                    await responseMethod('This player has no bees!');
                    return;
                }

                const beeIds = findPlayerBees.map(bee => bee.dataValues.beeid);
                const findPlayerBeeInfo = await beelist.findAll({ where: { beeid: beeIds } });

                const pages = [];
                const beesPerPage = 6;
                for (let i = 0; i < findPlayerBees.length; i += beesPerPage) {
                    const beesOnPage = findPlayerBees.slice(i, i + beesPerPage);
                    const beeFields = [];

                    for (const bee of beesOnPage) {
                        const beeInfo = findPlayerBeeInfo.find(beeType => beeType.beeid === bee.get('beeid'));
                        const beeIncrease = await calculateBeeIncrease(bee, beeInfo, true);
                        const suffix = increaseTypeSuffixMap[beeInfo.get('increaseType')];

                        beeFields.push({
                            name: `**${bee.get('beeName')}**`,
                            value: `Species: ${capitaliseWords(beeInfo.get('beeName'))} \nLevel: ${bee.get('beeLevel')}/${Math.floor(beeInfo.get('levelCapMultiplier') * 10 * (0.1 * findTarget.get('prestiges') + 1))} \nIncrease: ${beeIncrease} ${suffix}`,
                            inline: true,
                        });
                    }

                    const beeembed = new EmbedBuilder()
                        .setColor(0xffe521)
                        .setAuthor({ name: `${capitaliseWords(requestplayer.username)}'s bees`, iconURL: requestplayer.displayAvatarURL() })
                        .setFooter({ text: beeFact() })
                        .addFields({ name: 'Bees', value: `These are all your bees. \nNames for bees are nicknames you can give to bees. These names must be unique compared to your other bee's names.  \n\nBee slots: ${await playerbees.count({ where: { playerid: requestplayer.id } })}/${findTarget.get('beeSlots')}` })
                        .addFields(beeFields);
                    pages.push(beeembed);
                }

                let currentPage = 0;
                const row = new ActionRowBuilder()
                    .addComponents([
                        new ButtonBuilder().setCustomId('firstPage').setStyle(ButtonStyle.Secondary).setEmoji('⏪'),
                        new ButtonBuilder().setCustomId('prevPage').setStyle(ButtonStyle.Secondary).setEmoji('◀️'),
                        new ButtonBuilder().setCustomId('nextPage').setStyle(ButtonStyle.Secondary).setEmoji('▶️'),
                        new ButtonBuilder().setCustomId('lastPage').setStyle(ButtonStyle.Secondary).setEmoji('⏩'),
                    ]);

                const embedMessage = await responseMethod({ embeds: [pages[currentPage]], components: pages.length > 1 ? [row] : [] });
                if (pages.length > 1) {
                    const collector = embedMessage.createMessageComponentCollector({ time: 90000 });
                    collector.on('collect', async i => {
                        if (i.user.id === interactionAuth.id) {
                            if (!i.deferred) await i.deferUpdate();
                            switch (i.customId) {
                                case 'firstPage': currentPage = 0; break;
                                case 'prevPage': currentPage = (currentPage - 1 + pages.length) % pages.length; break;
                                case 'nextPage': currentPage = (currentPage + 1) % pages.length; break;
                                case 'lastPage': currentPage = pages.length - 1; break;
                            }
                            await i.editReply({ embeds: [pages[currentPage]], components: [row] });
                        }
                    });

                    collector.on('end', () => embedMessage.edit({ components: [] }));
                }
            }
            catch (error) {
                console.error(error);
                await responseMethod(`There was an error: ${error.message}`);
            }
        },
};