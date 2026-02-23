const { SlashCommandBuilder } = require('discord.js');
const approvalService = require('../../services/approvalService');
const xpService = require('../../services/xpService');
const { COINS } = require('../../constants');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eigenerolle')
    .setDescription('Beantrage eine eigene Rolle')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Name der Rolle').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('farbe').setDescription('Hex-Farbcode (z.B. #FF5733)').setRequired(true)
    )
    .setDefaultMemberPermissions(0),
  async execute(interaction) {
    const name = interaction.options.getString('name');
    const color = interaction.options.getString('farbe');

    if (!/^#?[0-9A-Fa-f]{6}$/.test(color)) {
      return interaction.reply({
        content: '❌ Ungültiger Hex-Farbcode. Beispiel: `#FF5733`',
        ephemeral: true,
      });
    }

    const hexColor = color.startsWith('#') ? color : `#${color}`;

    try {
      const request = await approvalService.createOwnRoleRequest(interaction, name, hexColor);
      const user = await xpService.getOrCreateUser(interaction.guild.id, interaction.user.id);
      const cost = COINS.OWN_ROLE_BASE_COST + (user.ownRoleCount * COINS.OWN_ROLE_INCREMENT);

      await interaction.reply({
        content: `Deine Anfrage für die Rolle **${name}** (${hexColor}) wurde eingereicht!\nKosten: **${formatCoins(cost)}** (werden erst bei Genehmigung abgezogen).\nDas Team wird deine Anfrage prüfen.`,
        ephemeral: true,
      });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
