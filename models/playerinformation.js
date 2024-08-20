module.exports = (sequelize, DataTypes) => {
    return sequelize.define('playerinformation', {
        playerid: {
            type: DataTypes.STRING,
            primaryKey: true,
        },
        money: DataTypes.BIGINT.UNSIGNED,
        lastMessage: DataTypes.BIGINT.UNSIGNED,
        prestiges: DataTypes.INTEGER.UNSIGNED,
        beeSlots: DataTypes.INTEGER.UNSIGNED,
        level: {
            type: DataTypes.INTEGER.UNSIGNED,
            defaultValue: 0,
        },
        playerXp: {
            type: DataTypes.BIGINT.UNSIGNED,
            defaultValue: 0,
        },
    }, {
        timestamps: false,
    });
};