module.exports = (sequelize, DataTypes) => {
    return sequelize.define('playerbees', {
        playerid: DataTypes.STRING,
        beeid: DataTypes.SMALLINT.UNSIGNED,
        beeLevel: DataTypes.TINYINT.UNSIGNED,
        beeName: DataTypes.STRING,
    }, {
        timestamps: false,
    });
};