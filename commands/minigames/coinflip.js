const { SlashCommandBuilder } = require('discord.js');

// Initialise all functions and required tables from universal module
const {
    playerinformation,
    interactionAuthFunc,
 } = require('C:/Bee Shop/universalmodule.js');

playerinformation.sync();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('coinflip')
		.setDescription('Do a coinflip and choose between heads or tails.')
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('Choose between heads or tails.')
                .setRequired(true),
        )
        .addIntegerOption(option =>
            option.setName('money')
                .setDescription('How much money to bet.')
                .setRequired(true),
        ),
    async execute(responseMethod, interaction, isSlash, args) {
        // Determine command execution type and therefore where arguments are stored
        const interactionAuth = await interactionAuthFunc(isSlash, interaction);
        const coinChoice = isSlash ? interaction.options.getString('choice') : args[0]?.toLowerCase();
        const amountOfMoney = isSlash ? interaction.options.getInteger('money') : parseInt(args[1]);
        // Make sure arguments pass checks (i.e coinChoice being heads or tails)
        if (!coinChoice || (coinChoice !== 'heads' && coinChoice !== 'tails')) { return responseMethod('You must choose between heads or tails!'); }
        if (isNaN(amountOfMoney)) { return responseMethod('You must specify an amount of money!'); }
        const findplayer = await playerinformation.findOne({ where: { playerid: interactionAuth.id } });
        if (findplayer.get('money') < amountOfMoney) { return responseMethod('You don\'t have enough money for the bet!'); }
        if (amountOfMoney < 0) { return responseMethod('You need to bet at least 0 money or more!'); }
        // Generate the result and tell the player the result
        const cfArray = ['heads', 'tails'];
        const cfOutcome = cfArray[Math.floor(Math.random() * 2)];
        if (cfOutcome === coinChoice) {
            responseMethod(`The coin landed on ${cfOutcome}! You won ${amountOfMoney} money!`);
            findplayer.update({ money: Math.floor(findplayer.get('money') + amountOfMoney) });
        }
        else {
            responseMethod(`The coin landed on ${cfOutcome}. You lost ${amountOfMoney} money.`);
            findplayer.update({ money: findplayer.get('money') - amountOfMoney });
        }
    },
};