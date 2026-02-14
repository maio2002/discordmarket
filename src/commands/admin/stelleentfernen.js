const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const JobListing = require('../../models/JobListing');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stelle-entfernen')
    .setDescription('Entferne ein Stellenangebot')
    .addStringOption(opt =>
      opt.setName('stelle').setDescription('Titel der Stelle').setRequired(true).setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const listings = await JobListing.find({ guildId: interaction.guild.id, isOpen: true }).lean();
    const filtered = listings
      .filter(j => j.title.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(j => ({ name: `${j.title} (${j.type})`, value: j._id.toString() }));
    await interaction.respond(filtered);
  },
  async execute(interaction) {
    const listingId = interaction.options.getString('stelle');

    const listing = await JobListing.findOneAndUpdate(
      { _id: listingId, guildId: interaction.guild.id, isOpen: true },
      { isOpen: false },
      { new: true }
    );

    if (!listing) {
      return interaction.reply({ content: '❌ Diese Stelle existiert nicht oder ist bereits geschlossen.', ephemeral: true });
    }

    const embed = createEmbed({
      title: 'Stellenangebot geschlossen ✅',
      color: COLORS.JOB,
      description: `**${listing.title}** wurde geschlossen.`,
    });
    await interaction.reply({ embeds: [embed] });
  },
};
