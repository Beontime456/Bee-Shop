module.exports = (sequelize, DataTypes) => {
    return sequelize.define('beelist', {
        beeid: {
            type: DataTypes.SMALLINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        beeName: DataTypes.STRING,
        findType: DataTypes.STRING,
        beePrice: DataTypes.INTEGER.UNSIGNED,
        beeBaseIncrease: DataTypes.FLOAT.UNSIGNED,
        increaseType: DataTypes.ENUM('add-c', 'multiply-c', 'add-x', 'multiply-x', 'add-p', 'multiply-p'),
        prestigeReq: DataTypes.INTEGER.UNSIGNED,
        levelReq: DataTypes.INTEGER.UNSIGNED,
        levelCapMultiplier: DataTypes.FLOAT.UNSIGNED,
        growthFactor: DataTypes.FLOAT.UNSIGNED,
    }, {
        timestamps: false,
    });
};