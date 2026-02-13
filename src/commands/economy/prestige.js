const { SlashCommandBuilder } = require('discord.js');
const marketService = require('../../services/marketService');
const MarketRole = require('../../models/MarketRole');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');
const { COINS } = require('../../constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prestige')
    .setDescription('Kaufe eine Prestige-Rolle')
    .addStringOption(opt =>
      opt
        .setName('rolle')
        .setDescription('Name der Prestige-Rolle')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const roles = await MarketRole.find({ guildId: interaction.guild.id, isPrestige: true }).lean();
    const filtered = roles
      .filter(r => r.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(r => ({ name: `${r.name} (${COINS.PRESTIGE_COST} Coins)`, value: r.name }));
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

      if (!marketRole.isPrestige) {
        return interaction.reply({
          content: '❌ Diese Rolle ist keine Prestige-Rolle. Nutze `/kaufen` stattdessen.',
          ephemeral: true,
        });
      }

      const embed = createEmbed({
        title: 'Prestige-Rolle gekauft! ⭐',
        color: COLORS.GOLD,
        fields: [
          { name: 'Rolle', value: marketRole.name, inline: true },
          { name: 'Preis', value: formatCoins(price), inline: true },
        ],
      });

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
