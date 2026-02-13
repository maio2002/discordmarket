const { SlashCommandBuilder } = require('discord.js');
const xpService = require('../../services/xpService');
const { createEmbed, COLORS, xpProgressBar } = require('../../utils/embedBuilder');
const { formatXp, formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rang')
    .setDescription('Zeigt deinen Rang, Level und XP an')
    .addUserOption(opt =>
      opt.setName('nutzer').setDescription('Rang eines anderen Nutzers anzeigen')
    ),
  async execute(interaction) {
    const target = interaction.options.getUser('nutzer') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    const user = await xpService.getOrCreateUser(interaction.guild.id, target.id);
    const rank = await xpService.getRank(interaction.guild.id, target.id);
    const { current, needed } = xpService.getXpProgress(user.xp, user.level);

    const embed = createEmbed({
      title: `Rang von ${member?.displayName || target.username}`,
      color: COLORS.XP,
      thumbnail: target.displayAvatarURL({ size: 128 }),
      fields: [
        { name: 'Rang', value: `#${rank}`, inline: true },
        { name: 'Level', value: `${user.level}`, inline: true },
        { name: 'Coins', value: formatCoins(user.coins), inline: true },
        {
          name: `Fortschritt (${formatXp(current)} / ${formatXp(needed)})`,
          value: xpProgressBar(current, needed),
          inline: false,
        },
        { name: 'Gesamt-XP', value: formatXp(user.xp), inline: true },
      ],
      footer: `MaioBot XP-System`,
    });

    await interaction.reply({ embeds: [embed] });
  },
};
