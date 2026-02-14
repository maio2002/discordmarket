const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Service = require('../../models/Service');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dienstleistung-entfernen')
    .setDescription('Entferne eine Dienstleistung aus dem Shop')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Name der Dienstleistung').setRequired(true).setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const services = await Service.find({ guildId: interaction.guild.id, isActive: true }).lean();
    const filtered = services
      .filter(s => s.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(s => ({ name: s.name, value: s.name }));
    await interaction.respond(filtered);
  },
  async execute(interaction) {
    const name = interaction.options.getString('name');

    const service = await Service.findOneAndDelete({
      guildId: interaction.guild.id,
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (!service) {
      return interaction.reply({ content: '❌ Diese Dienstleistung existiert nicht.', ephemeral: true });
    }

    const embed = createEmbed({
      title: 'Dienstleistung entfernt ✅',
      color: COLORS.MARKET,
      description: `**${service.name}** wurde aus dem Shop entfernt.`,
    });
    await interaction.reply({ embeds: [embed] });
  },
};
