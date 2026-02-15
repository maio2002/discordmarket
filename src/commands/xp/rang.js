const { SlashCommandBuilder } = require('discord.js');
const xpService = require('../../services/xpService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');
const { LEVEL } = require('../../constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rang')
    .setDescription('Zeigt deinen Rang, Level und Coins an')
    .addUserOption(opt =>
      opt.setName('nutzer').setDescription('Rang eines anderen Nutzers anzeigen')
    ),
  async execute(interaction) {
    const target = interaction.options.getUser('nutzer') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    const user = await xpService.getOrCreateUser(interaction.guild.id, target.id);
    const rank = await xpService.getRank(interaction.guild.id, target.id);
    const isMaxLevel = user.level >= LEVEL.MAX_LEVEL;
    const nextLevelCost = isMaxLevel ? null : xpService.costForLevel(user.level + 1);

    const fields = [
      { name: 'Rang', value: `#${rank}`, inline: true },
      { name: 'Level', value: `${user.level}${isMaxLevel ? ' (Max)' : ''}`, inline: true },
      { name: 'Coins', value: formatCoins(user.coins), inline: true },
    ];

    if (!isMaxLevel) {
      fields.push({ name: 'Nächstes Level', value: formatCoins(nextLevelCost), inline: true });
    }

    const embed = createEmbed({
      title: `Rang von ${member?.displayName || target.username}`,
      color: COLORS.XP,
      thumbnail: target.displayAvatarURL({ size: 128 }),
      fields,
      footer: 'MaioBot Level-System',
    });

    await interaction.reply({ embeds: [embed] });
  },
};