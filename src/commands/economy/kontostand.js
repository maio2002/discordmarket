const { SlashCommandBuilder } = require('discord.js');
const xpService = require('../../services/xpService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kontostand')
    .setDescription('Zeigt deinen Kontostand an')
    .addUserOption(opt =>
      opt.setName('nutzer').setDescription('Kontostand eines anderen Nutzers')
    ),
  async execute(interaction) {
    const target = interaction.options.getUser('nutzer') || interaction.user;
    const user = await xpService.getOrCreateUser(interaction.guild.id, target.id);

    const embed = createEmbed({
      title: `Kontostand — ${target.username}`,
      color: COLORS.GOLD,
      thumbnail: target.displayAvatarURL({ size: 128 }),
      fields: [
        { name: '💰 Coins', value: formatCoins(user.coins), inline: true },
        { name: '📈 Level', value: `${user.level}`, inline: true },
      ],
      footer: 'MaioBot Wirtschaft',
    });

    await interaction.reply({ embeds: [embed] });
  },
};
