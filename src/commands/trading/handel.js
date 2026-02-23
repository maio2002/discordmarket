const { SlashCommandBuilder } = require('discord.js');
const tradeService = require('../../services/tradeService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('handel')
    .setDescription('Nehme ein Handelsangebot an')
    .addStringOption(opt =>
      opt.setName('id').setDescription('Angebots-ID').setRequired(true)
    )
    .setDefaultMemberPermissions(0),
  async execute(interaction) {
    const offerId = interaction.options.getString('id');

    try {
      const { offer, completed } = await tradeService.acceptOffer(
        interaction.guild.id,
        offerId,
        interaction.user.id,
        interaction.guild
      );

      if (completed) {
        const embed = createEmbed({
          title: 'Handel abgeschlossen! ✅',
          color: COLORS.SUCCESS,
          fields: [
            { name: 'Angebot', value: offer.description, inline: false },
            { name: 'Verkäufer', value: `<@${offer.sellerId}>`, inline: true },
            { name: 'Käufer', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Preis', value: formatCoins(offer.price), inline: true },
          ],
        });

        await interaction.reply({ embeds: [embed] });
      }
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
