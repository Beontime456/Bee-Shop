const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Initialise all functions and required tables from universal module
const {
    playerinformation,
    playerbees,
    beelist,
    beeFact,
    calculateAllBees,
    interactionAuthFunc,
} = require('C:/Bee Shop/universalmodule.js');

playerinformation.sync();
playerbees.sync();
beelist.sync();

// Function for the actual number guess game loop
async function numberGuess(numberToGuess, interactionAuth, interaction, attempts = 0) {
    if (attempts === 5) {
        return [false];
    }
    const collectorFilter = (response) => response.author.id === interactionAuth.id;
    try {
        const messages = await interaction.channel.awaitMessages({ filter: collectorFilter, time: 30000, max: 1, errors: ['time'] });
        const response = messages.first();
        if (response.content === numberToGuess.toString()) {
            const multiplierMod = attempts === 0 ? 3 : (attempts === 1 ? 1 : 0);
            return [true, multiplierMod];
        }
        else {
            const hint = response.content < numberToGuess ? 'low' : 'high';
            response.reply(`Incorrect, you guessed too ${hint}! Guess again!`);
            return await numberGuess(numberToGuess, interactionAuth, interaction, attempts + 1);
        }
    }
    catch (error) {
        return ['time'];
    }
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('guess')
		.setDescription('Play a number guessing game.'),
    async execute(responseMethod, interaction) {
        // Determine if the command was inititated through slash
        const interactionAuth = await interactionAuthFunc(interaction);
        const findplayer = await playerinformation.findOne({ where: { playerid: interactionAuth.id } });
        const startingMoney = findplayer.get('money');

        // Initialise the game and the required variables
        const { coins, xp } = await calculateAllBees(interactionAuth);
        const multiplier = 5;
        const numberToGuess = Math.floor(Math.random() * 10) + 1;
        const guessEmbed = new EmbedBuilder()
            .setColor(0xffe521)
            .setAuthor({ name: `${interactionAuth.displayName}'s Number Guessing Game`, iconURL: interactionAuth.displayAvatarURL() })
            .setFooter({ text: beeFact() })
            .setFields({ name: 'Number Guess', value: 'Started a number guess game! Guess the number within 5 attempts to win! Gussing correctly on your first and second tries awards 8 and 6 messages worth of money respectively. Any subsequent guesses give 5 if correct! \n\nIt\'s a number between 1 and 10 \nSend a message with your guess to take a guess.' });
        const guessMessage = await responseMethod({ embeds: [guessEmbed], fetchReply: true });

        // Begin the game and retrieve the result
        const gameResult = await numberGuess(numberToGuess, interactionAuth, interaction);
        if (gameResult[0] === 'time' || !gameResult[0]) {
            await guessMessage.reply(gameResult[0] === 'time' ? 'You ran out of time!' : 'You guessed incorrectly 5 times! You lost!');
        }
        else {
            const winMoney = Math.floor(coins * (gameResult[1] + multiplier) * (1.2 * findplayer.get('prestiges') + 1) + findplayer.get('level'));
            const winXp = Math.floor(xp * (gameResult[1] + multiplier) * (1.05 * findplayer.get('prestiges') + 1));
            await guessMessage.reply(`Congrats, you guessed the number correctly! You won ${winMoney} money and ${winXp} XP!`);
            await findplayer.update({ money: startingMoney + winMoney, playerXp: findplayer.get('playerXp') + winXp });
        }
    },
};