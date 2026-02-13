const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const marketService = require('../../services/marketService');
const MarketRole = require('../../models/MarketRole');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('marktentfernen')
    .setDescription('Entferne eine Rolle aus dem Shop')
    .addStringOption(opt =>
      opt
        .setName('rolle')
        .setDescription('Name der Rolle')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const roles = await MarketRole.find({ guildId: interaction.guild.id }).lean();
    const filtered = roles
      .filter(r => r.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(r => ({ name: r.name, value: r.name }));
    await interaction.respond(filtered);
  },
  async execute(interaction) {
    const name = interaction.options.getString('rolle');

    try {
      const removed = await marketService.removeMarketRole(interaction.guild.id, name);
      await interaction.reply({ content: `Rolle **${removed.name}** aus dem Shop entfernt. ✅` });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
