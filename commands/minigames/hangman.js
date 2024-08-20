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

// Array of bee-related words for hangman
const beeWords = ['hive', 'queen', 'honey', 'pollen', 'nectar', 'worker', 'drone', 'wax', 'colony', 'comb', 'swarm', 'sting', 'beekeeper', 'apiary', 'insects'];

// Function to generate the word shown to the player
async function createDisplayWord(guessedLetters, displayWord, secretWord) {
    return secretWord.split('').map((char, index) => guessedLetters.includes(char) ? char : displayWord[index]).join('');
}

// Function for the actual hangman game loop
async function hangman(secretWord, guessedLetters, displayWord, interactionAuth, interaction, attempts = 0) {
    if (attempts >= 5) {
        // Game over after 5 incorrect attempts
        return [false];
    }

    const collectorFilter = (response) => response.author.id === interactionAuth.id;
    try {
        const messages = await interaction.channel.awaitMessages({ filter: collectorFilter, time: 60000, max: 1, errors: ['time'] });
        const response = messages.first();
        const guess = response.content.toLowerCase();

        // Check if the guess is valid
        if (guess.length !== 1 || !/^[a-z]$/i.test(guess)) {
            response.reply('Please guess a single letter from a to z!');
            return await hangman(secretWord, guessedLetters, displayWord, interactionAuth, interaction, attempts);
        }

        // Check if the letter has already been guessed
        if (guessedLetters.includes(guess)) {
            response.reply('You already guessed this letter! Guess a different letter.');
            return await hangman(secretWord, guessedLetters, displayWord, interactionAuth, interaction, attempts);
        }

        // Add the guessed letter to the list of already guessed letters
        // If the user picks out one of the letters in the word, display all instances of the letter in the word
        guessedLetters.push(guess);
        if (secretWord.includes(guess)) {
            displayWord = await createDisplayWord(guessedLetters, displayWord, secretWord);
            if (displayWord === secretWord) {
                const multiplierMod = attempts === 0 ? 3 : (attempts === 1 ? 2 : 1);
                return [true, multiplierMod];
            }
        }
        else {
            attempts++;
        }

        // Send status update
        const hangmanEmbed = new EmbedBuilder()
            .setColor(0xffe521)
            .setAuthor({ name: `${interactionAuth.displayName}'s game of Hangman`, iconURL: interactionAuth.displayAvatarURL() })
            .setFooter({ text: beeFact() })
            .setFields({ name: 'Hangman', value: `Word: \`${displayWord}\` \nAttempts: ${attempts}/5 \nGuessed Letters: ${guessedLetters.join(', ')}` });

        response.reply({ embeds: [hangmanEmbed] });
        return await hangman(secretWord, guessedLetters, displayWord, interactionAuth, interaction, attempts);
    }
    catch (error) {
        return ['time'];
    }
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('hangman')
		.setDescription('Play a game of hangman.'),
    async execute(responseMethod, interaction, isSlash) {
        const interactionAuth = await interactionAuthFunc(isSlash, interaction);
        const findplayer = await playerinformation.findOne({ where: { playerid: interactionAuth.id } });
        const startingMoney = findplayer.get('money');
        const { coins, xp } = await calculateAllBees(interactionAuth);
        const multiplier = 5;
        const secretWord = beeWords[Math.floor(Math.random() * beeWords.length)];
        const displayWord = '_'.repeat(secretWord.length);
        const guessedLetters = [];
        const hangmanEmbed = new EmbedBuilder()
            .setColor(0xffe521)
            .setAuthor({ name: `${interactionAuth.displayName}'s game of Hangman`, iconURL: interactionAuth.displayAvatarURL() })
            .setFooter({ text: beeFact() })
            .setFields({ name: 'Hangman', value: `Started a hangman game! Find the secret word by guessing letters that might be in the word! \nYou can guess any letter from a-z, and you are allowed 5 incorrect guesses before losing. Get better rewards for less incorrect guesses! \n\nWord: \`${displayWord}\` \nIncorrect Guesses: 0/5` });
        const hangmanMessage = await responseMethod({ embeds: [hangmanEmbed], fetchReply: true });
        const gameResult = await hangman(secretWord, guessedLetters, displayWord, interactionAuth, interaction);
        if (gameResult[0] === 'time' || !gameResult[0]) {
            await hangmanMessage.reply(gameResult[0] === 'time' ? 'You ran out of time!' : 'You guessed incorrectly 5 times! You lost!');
        }
        else {
            const winMoney = Math.floor(coins * (gameResult[1] + multiplier) * (1.2 * findplayer.get('prestiges') + 1) + findplayer.get('level'));
            const winXp = Math.floor(xp * (gameResult[1] + multiplier) * (1.05 * findplayer.get('prestiges') + 1));
            await hangmanMessage.reply(`Congrats, you guessed the word correctly! You won ${winMoney} money and ${winXp} XP!`);
            await findplayer.update({ money: startingMoney + winMoney, playerXp: findplayer.get('playerXp') + winXp });
        }
    },
};