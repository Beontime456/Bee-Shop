const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

// Maze move map
const moveMap = {
    'up': { x: 0, y: -1 },
    'down': { x: 0, y: 1 },
    'left': { x: -1, y: 0 },
    'right': { x: 1, y: 0 },
};

// Function to generate maze
function generateMaze(width, height) {
    const maze = Array.from({ length: height }, () => Array.from({ length: width }, () => false));
    let exitSet = false;

    function carve(x, y) {
        const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
        maze[y][x] = true;

        // Randomly shuffle directions to ensure maze randomness
        directions.sort(() => Math.random() - 0.5);

        directions.forEach(([dx, dy]) => {
            const nx = x + 2 * dx, ny = y + 2 * dy;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width && !maze[ny][nx]) {
                // Carve path to the new cell
                maze[y + dy][x + dx] = true;
                carve(nx, ny);
            }
        });

        // Attempt to set an exit if this path is on the boundary and no exit has been set
        if (!exitSet && ((x === 1 && y > 1) || (x === width - 2 && y > 1) || (y === 1 && x > 1) || (y === height - 2 && x > 1))) {
            // Mark this position as the exit
            maze[y][x] = 'exit';
            exitSet = true;
        }
    }

    // Start carving from the upper-left corner
    carve(1, 1);
    // Fallback if no exit was set
    if (!exitSet) {
        // Set start as exit if no exit was set (unlikely, but safe fallback)
        maze[1][1] = 'exit';
    }
    return maze;
}

// Function to render maze
function renderMaze(maze, playerPosition) {
    return maze.map((row, y) =>
        row.map((cell, x) => {
            // Player
            if (x === playerPosition.x && y === playerPosition.y) return '🔴';
            // Exit
            if (cell === 'exit') return '🟩';
            // Open path and wall
            return cell ? '🟦' : '⬛';
        }).join(''),
    ).join('\n');
}

function createNavigationButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('up').setEmoji('⬆️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('down').setEmoji('⬇️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('left').setEmoji('⬅️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('right').setEmoji('➡️').setStyle(ButtonStyle.Primary),
        );
}

async function mazeGameLoop(maze, interactionAuth, mazeMessage, playerPos) {
    const collectorFilter = i => {
        i.deferUpdate();
        return i.user.id === interactionAuth.id;
    };

    try {
        const i = await mazeMessage.awaitMessageComponent({ filter: collectorFilter, time: 30000 });
        const move = moveMap[i.customId];
        const newX = playerPos.x + move.x;
        const newY = playerPos.y + move.y;

        if (maze[newY][newX] === 'exit') {
            playerPos.x = newX;
            playerPos.y = newY;
            await updateMazeEmbed(interactionAuth, mazeMessage, maze, playerPos, true);
            return true;
        }

        if (newX >= 0 && newX < maze[0].length && newY >= 0 && newY < maze.length && maze[newY][newX]) {
            playerPos.x = newX;
            playerPos.y = newY;
            await updateMazeEmbed(interactionAuth, mazeMessage, maze, playerPos, false);
            return mazeGameLoop(maze, interactionAuth, mazeMessage, playerPos);
        }
        else {
            return mazeGameLoop(maze, interactionAuth, mazeMessage, playerPos);
        }
    }
    catch (error) {
        return false;
    }
}

async function updateMazeEmbed(interactionAuth, mazeMessage, maze, playerPos, isExit) {
    const mazeEmbed = new EmbedBuilder()
        .setColor(0xffe521)
        .setAuthor({ name: `${interactionAuth.displayName}'s Maze Game`, iconURL: interactionAuth.displayAvatarURL() })
        .setFooter({ text: beeFact() })
        .setFields({ name: 'Maze', value: 'Move the player (🔴) to the exit (🟩). The player can only move on 🟦 tiles and the exit tile.' })
        .addFields({ name: '\u200b', value: renderMaze(maze, playerPos) });
    const components = isExit ? [] : [createNavigationButtons()];
    await mazeMessage.edit({ embeds: [mazeEmbed], components: components });
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('maze')
		.setDescription('Navigate through a randomly generated maze to win coins and XP.')
        .addStringOption(option =>
            option.setName('difficulty')
                .setDescription('Set the difficulty of the maze (easy, medium, hard)')
                .setRequired(true)
                .addChoices(
                    { name: 'Easy', value: 'easy' },
                    { name: 'Medium', value: 'medium' },
                    { name: 'Hard', value: 'hard' },
                )),
    async execute(responseMethod, interaction, isSlash, args) {
        // Determine if the command was inititated through slash
        const interactionAuth = await interactionAuthFunc(isSlash, interaction);
        const mazeDifficulty = isSlash ? interaction.options.getString('difficulty') : args[0];
        if (mazeDifficulty != 'easy' && mazeDifficulty != 'medium' && mazeDifficulty != 'hard') { return responseMethod('You need to choose one of the difficulty options (easy, medium, or hard)!'); }
        const findplayer = await playerinformation.findOne({ where: { playerid: interactionAuth.id } });
        // Initialise the game and the required variables
        const { coins, xp } = await calculateAllBees(interactionAuth);
        const multiplier = mazeDifficulty === 'easy' ? 5 : mazeDifficulty === 'medium' ? 10 : 15;
        const mazeSize = mazeDifficulty === 'easy' ? 6 : mazeDifficulty === 'medium' ? 10 : 14;
        const maze = generateMaze(mazeSize, mazeSize);
        const playerPos = { x: 1, y: 1 };
        const renderedMaze = renderMaze(maze, playerPos);
        const mazeButtons = createNavigationButtons();
        const mazeEmbed = new EmbedBuilder()
            .setColor(0xffe521)
            .setAuthor({ name: `${interactionAuth.displayName}'s Maze Game`, iconURL: interactionAuth.displayAvatarURL() })
            .setFooter({ text: beeFact() })
            .setFields({ name: 'Maze', value: 'Started a maze game! \nMove the player (🔴) to the exit (🟩). \nThe player can only move on 🟦 tiles and the exit tile.' })
            .addFields({ name: '\u200b', value: renderedMaze });
        const mazeMessage = await responseMethod({ embeds: [mazeEmbed], components: [mazeButtons], fetchReply: true });
        const gameResult = await mazeGameLoop(maze, interactionAuth, mazeMessage, playerPos);
        if (!gameResult) { return mazeMessage.reply('You ran out of time!'); }
        const winMoney = Math.floor(coins * multiplier * (1.2 * findplayer.get('prestiges') + 1) + findplayer.get('level'));
        const winXp = Math.floor(xp * multiplier * (1.05 * findplayer.get('prestiges') + 1));
        await mazeMessage.reply(`Congrats, you made it to the exit of the maze! You won ${winMoney} money and ${winXp} XP!`);
        await findplayer.update({ money: findplayer.get('money') + winMoney, playerXp: findplayer.get('playerXp') + winXp });
    },
};