// Dependencies for command
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Initialise all functions and required tables from universal module
const {
    playerinformation,
    playerbees,
    beelist,
    beeFact,
    calculateAllBees,
    interactionAuthFunc,
    requestPlayerFunc,
} = require('C:/Bee Shop/universalmodule.js');

playerinformation.sync();
playerbees.sync();
beelist.sync();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('profile')
		.setDescription('Check out your stats.')
        .addUserOption(option => option.setName('user').setDescription('Check another players stats')),
	async execute(responseMethod, interaction, isSlash, args, client) {
        try {
            // Checks if the command was initiated through slash or text.
            const interactionAuth = await interactionAuthFunc(isSlash, interaction);
            const requestplayer = await requestPlayerFunc(isSlash, interaction, args, client, interactionAuth);
            // Creates the player embed, displaying important info about another player
            const findTarget = await playerinformation.findOne({ where: { playerid: requestplayer.id } });
            const { coins, xp, prestiges } = await calculateAllBees(interactionAuth);
            const profileembed = new EmbedBuilder()
                .setColor(0xffe521)
                .setAuthor({ name: `${requestplayer.displayName}'s profile`, iconURL: requestplayer.displayAvatarURL() })
                .setFooter({ text: beeFact() })
                .setThumbnail(requestplayer.displayAvatarURL())
                .addFields(
                    { name: 'Stats', value:
                    `\nLevel: ${findTarget.get('level')}` +
                    `\nXP: ${findTarget.get('playerXp')}/${Math.floor(100 * Math.pow(1.5, findTarget.get('level')))}` +
                    `\nMoney: ${findTarget.get('money')}` +
                    `\nBee Slots: ${findTarget.get('beeSlots')}` +
                    `\nPrestiges: ${findTarget.get('prestiges')}`,
                    }, {
                    name: 'Gains', value:
                    `\nGain Per Message (G/M): ${Math.floor(coins * (1 + 0.2 * findTarget.get('prestiges')) + findTarget.get('level'))}` +
                    `\nXP Per Message (X/M): ${Math.floor(xp * (1 + 0.05 * findTarget.get('prestiges')))}` +
                    `\nPrestige Gain Per Prestige (P/P): ${prestiges}`,
                });
            responseMethod({ embeds: [profileembed] });
        }
        catch (error) {
            if (error.name === 'TypeError') {
                responseMethod('This player has not started!');
            }
            else if (error.name === 'DiscordAPIError[10013]') {
                responseMethod('Please mention a player!');
            }
            else {
                responseMethod(`There was an error! ${error.name}: ${error.message}`);
                console.log(error);
            }
        }
    },
};