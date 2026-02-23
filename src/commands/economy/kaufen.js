const { SlashCommandBuilder } = require('discord.js');
const marketService = require('../../services/marketService');
const MarketRole = require('../../models/MarketRole');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kaufen')
    .setDescription('Kaufe eine Rolle aus dem Shop')
    .addStringOption(opt =>
      opt
        .setName('rolle')
        .setDescription('Name der Rolle')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .setDefaultMemberPermissions(0),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const roles = await MarketRole.find({ guildId: interaction.guild.id }).lean();
    const filtered = roles
      .filter(r => r.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(r => ({ name: `${r.name} (${r.price} Coins)`, value: r.name }));
    await interaction.respond(filtered);
  },
  async execute(interaction) {
    const roleName = interaction.options.getString('rolle');

    try {
      const { marketRole, price } = await marketService.buyRole(
        interaction.guild.id,
        interaction.user.id,
        roleName,
        interaction.guild
      );

      const embed = createEmbed({
        title: 'Rolle gekauft! 🎉',
        color: COLORS.SUCCESS,
        fields: [
          { name: 'Rolle', value: marketRole.name, inline: true },
          { name: 'Preis', value: formatCoins(price), inline: true },
          { name: 'Verbleibend', value: `${marketRole.totalStock - marketRole.purchased}`, inline: true },
        ],
      });

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
