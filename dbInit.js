const Sequelize = require('sequelize');
const { dbUser, dbPass } = require('./config.json');

// Initialise connection with database
const sequelize = new Sequelize('playerinfo', dbUser, dbPass, {
    host: 'localhost',
    dialect: 'mysql',
    logging: false,
 });

// Sync beelist table with current iteration in models
const beelist = require('./models/beelist.js')(sequelize, Sequelize.DataTypes);

const force = process.argv.includes('--force') || process.argv.includes('-f');

sequelize.sync({ force }).then(async () => {
    const bees = [
        beelist.upsert({ beeName: 'basic bee', findType: 'shop', beePrice: 100, beeBaseIncrease: 1, increaseType: 'add-c', prestigeReq: 0, levelReq: 0, levelCapMultiplier: 0.1, growthFactor: 2 }),
        beelist.upsert({ beeName: 'god bee', findType: 'shop', beePrice: 10000000, beeBaseIncrease: 100, increaseType: 'multiply-c', prestigeReq: 50, levelReq: 100, levelCapMultiplier: 10, growthFactor: 1.05 }),
        beelist.upsert({ beeName: 'prestigious bee', findType: 'shop', beePrice: 1000, beeBaseIncrease: 1, increaseType: 'add-p', prestigeReq: 1, levelReq: 0, levelCapMultiplier: 0.5, growthFactor: 1.3 }),
        beelist.upsert({ beeName: 'illustrious bee', findType: 'shop', beePrice: 20000, beeBaseIncrease: 2, increaseType: 'multiply-p', prestigeReq: 20, levelReq: 0, levelCapMultiplier: 1, growthFactor: 1.2 }),
        beelist.upsert({ beeName: 'experienced bee', findType: 'shop', beePrice: 500, beeBaseIncrease: 5, increaseType: 'add-x', prestigeReq: 0, levelReq: 20, levelCapMultiplier: 1.5, growthFactor: 1.5 }),
        beelist.upsert({ beeName: 'skillful bee', findType: 'shop', beePrice: 2000, beeBaseIncrease: 1.5, increaseType: 'multiply-x', prestigeReq: 0, levelReq: 30, levelCapMultiplier: 3, growthFactor: 1.25 }),
    ];

    await Promise.all(bees);

    console.log('Database synced');

    sequelize.close();
}).catch(console.error);