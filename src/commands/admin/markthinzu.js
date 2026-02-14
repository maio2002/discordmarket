const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const marketService = require('../../services/marketService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('markthinzu')
    .setDescription('Füge eine Rolle zum Shop hinzu')
    .addRoleOption(opt =>
      opt.setName('rolle').setDescription('Die Discord-Rolle').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('preis').setDescription('Preis in Coins').setRequired(true).setMinValue(1)
    )
    .addIntegerOption(opt =>
      opt.setName('bestand').setDescription('Verfügbare Menge').setRequired(true).setMinValue(1)
    )
    .addBooleanOption(opt =>
      opt.setName('prestige').setDescription('Ist dies eine Prestige-Rolle?')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const role = interaction.options.getRole('rolle');
    const price = interaction.options.getInteger('preis');
    const stock = interaction.options.getInteger('bestand');
    const isPrestige = interaction.options.getBoolean('prestige') || false;

    try {
      await marketService.addMarketRole(
        interaction.guild.id,
        role.name,
        role.id,
        price,
        stock,
        isPrestige
      );

      const embed = createEmbed({
        title: 'Rolle zum Shop hinzugefügt ✅',
        color: COLORS.MARKET,
        fields: [
          { name: 'Rolle', value: role.name, inline: true },
          { name: 'Preis', value: formatCoins(price), inline: true },
          { name: 'Bestand', value: `${stock}`, inline: true },
          { name: 'Prestige', value: isPrestige ? 'Ja ⭐' : 'Nein', inline: true },
        ],
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
