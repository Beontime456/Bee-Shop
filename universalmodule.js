// Universal module file
// Use this for any functions or database references in any given command and pull from it accordingly.
// Everything but single use functions should go here.
const { Sequelize } = require('sequelize');
const { dbUser, dbPass } = require('./config.json');

// Initialise connection with database
const sequelize = new Sequelize('playerinfo', dbUser, dbPass, {
    host: 'localhost',
    dialect: 'mysql',
    logging: false,
 });

// Initialise tables
const playerinformation = require('./models/playerinformation.js')(sequelize, Sequelize.DataTypes);
const playerbees = require('./models/playerbees.js')(sequelize, Sequelize.DataTypes);
const beelist = require('./models/beelist.js')(sequelize, Sequelize.DataTypes);

// Function for calculating how many levels the player gets if the player levels up at all.
async function calculateLevelUp(player) {
    let newLevel = player.get('level');
    const originalLevel = player.get('level');
    let xpNeeded = 100 * Math.floor(Math.pow(1.5, newLevel));
    let playerXp = player.get('playerXp');

    while (playerXp >= xpNeeded) {
        // Subtract the XP needed for the current level
        playerXp -= xpNeeded;
        // Increment the level
        newLevel++;
        // Calculate new XP needed for the next level
        xpNeeded = 100 * Math.floor(Math.pow(1.5, newLevel));
    }

    await player.update({ level: newLevel, playerXp: playerXp });

    return newLevel - originalLevel;
}

// Capitalise evry word in a given sentence
function capitaliseWords(sentence) {
    return sentence.replace(/\b\w/g, char => char.toUpperCase());
}

// Randomly select a bee fact for use at the footer of all embeds
function beeFact() {
    const beeFacts = ['Bumble bees are apart of the apidae bee family.', 'The average bumble bee life span is 4 weeks.', 'The majority of bumble bee species in Europe seemingly like the colours violet or blue.',
    'A honey bee can fly up to 15 miles per hour.', 'Bees are relatives of ants!', 'Male drone bees don\'t have a stinger.', 'Bees have 5 eyes.', 'Bees struggle distinguishing red colours compared to bluer tones.',
    'Worker bees communicate with dancing or shaking their bodies.', 'A bee flaps it\'s wings 200x per second.', 'Bees can experience PTSD-like symptoms.', 'Bees recognize different human faces.',
    'Bees like humans who take care of them!', 'Bees are usually optimistic when successfully foraging, but can become depressed if momentarily trapped by a predatory spider.',
    'The Megachilidae Bee family has the most diverse nesting habits. They construct hives using mud, gravel, resin, plant fiber, wood pulp, and leaf pulp.', 'The Megachilidae bee family builds their nests in cavities, mainly in rotting wood, using leaves.',
    'The Andrenidae bee family is collectively known as mining bees. It consists of solitary bees that nest on the ground!'];
    const randomFact = Math.floor(Math.random() * beeFacts.length);
    return beeFacts[randomFact];
}

// Calculate how much of an increase a bee gives to money
async function calculateBeeIncrease(bee, beeName, prefixReq) {
    const increaseType = await beeName.get('increaseType');
    const baseIncrease = await beeName.get('beeBaseIncrease');
    const growthFactor = await beeName.get('growthFactor');
    const beeLevel = bee.dataValues ? bee.dataValues.beeLevel : await bee.get('beeLevel');

    const beeIncrease = increaseType.startsWith('add-') ? Math.floor(baseIncrease * (growthFactor ** beeLevel)) : baseIncrease * (growthFactor ** beeLevel);

    const beePrefix = increaseType.startsWith('add-') ? '+' : 'x';
    return prefixReq ? `${beePrefix}${beeIncrease}` : beeIncrease;
}

// Money gained from a single message
async function calculateAllBees(messageAuth) {
    const allBees = await playerbees.findAll({ where: { playerid: messageAuth.id } });
    const beeIds = allBees.map(bee => bee.dataValues.beeid);

    // Fetch all relevant bee types at once
    const beeTypes = await beelist.findAll({
        where: {
            beeid: beeIds,
            increaseType: {
                [Sequelize.Op.or]: ['add-c', 'multiply-c', 'add-x', 'multiply-x', 'add-p', 'multiply-p'],
            },
        },
    });

    let baseGainC = 1, gainMultiplierC = 1, baseGainX = 1, gainMultiplierX = 1, baseGainP = 1, gainMultiplierP = 1;

    // Process each bee type
    for (const bee of allBees) {
        const currentBee = beeTypes.find(type => type.beeid === bee.beeid);
        const increaseType = currentBee.get('increaseType');
        const beeIncrease = await calculateBeeIncrease(bee, currentBee);

        if (increaseType.includes('c')) {
            increaseType.startsWith('add-') ? baseGainC += beeIncrease : gainMultiplierC += beeIncrease;
        }
        else if (increaseType.includes('x')) {
            increaseType.startsWith('add-') ? baseGainX += beeIncrease : gainMultiplierX += beeIncrease;
        }
        else if (increaseType.includes('p')) {
            increaseType.startsWith('add-') ? baseGainP += beeIncrease : gainMultiplierP += beeIncrease;
        }
    }

    return {
        coins: baseGainC * gainMultiplierC,
        xp: baseGainX * gainMultiplierX,
        prestiges: baseGainP * gainMultiplierP,
    };
}

// Text visualisation of the different gain types of bees generally used in bee and shop commands.
const increaseTypeSuffixMap = {
    'add-c': 'Coin(s)',
    'multiply-c': 'Coin(s)',
    'add-x': 'XP',
    'multiply-x': 'XP',
    'add-p': 'Prestige(s)',
    'multiply-p': 'Prestige(s)',
};

async function interactionAuthFunc(isSlash, interaction) {
    return isSlash ? interaction.user : interaction.author;
}

async function requestPlayerFunc(isSlash, interaction, args, client, interactionAuth) {
    return isSlash
    ? interaction.options.getUser('user') || interactionAuth
    : await client.users.fetch(args.length > 0 ? args[0].replace(/[\\<>@#&!]/g, '') : interactionAuth.id);
}

async function requestBeeFunc(isSlash, interaction, args) {
    return isSlash ? interaction.options.getString('name') : args.join(' ');
}

// Make sure a bee name does not contain illegal characters outside of letters a-z and punctuation.
function checkNameCompliance(name) {
    return /^(?!.*[@:#])[a-zA-Z0-9\s_.,!$%^&*()+=\-[\]{};'"<>?\\|`~/]+$/.test(name);
}

// Return every single function in this file for use by other commands and files.
module.exports = {
    playerinformation,
    playerbees,
    beelist,
    calculateLevelUp,
    beeFact,
    calculateBeeIncrease,
    calculateAllBees,
    capitaliseWords,
    increaseTypeSuffixMap,
    checkNameCompliance,
    interactionAuthFunc,
    requestPlayerFunc,
    requestBeeFunc,
};