const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const JobListing = require('../../models/JobListing');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stelle-hinzu')
    .setDescription('Erstelle ein neues Stellenangebot')
    .addStringOption(opt =>
      opt.setName('titel').setDescription('Titel der Stelle').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('beschreibung').setDescription('Beschreibung der Stelle').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('typ').setDescription('Stellentyp (z.B. Moderator, Support)')
        .setRequired(true)
        .addChoices(
          { name: 'Moderator', value: 'moderator' },
          { name: 'Support', value: 'support' },
          { name: 'Advertisement', value: 'advertisement' },
          { name: 'Examiner', value: 'examiner' },
        )
    )
    .addChannelOption(opt =>
      opt.setName('bewerbungschannel').setDescription('Channel für Bewerbungen').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const title = interaction.options.getString('titel');
    const description = interaction.options.getString('beschreibung');
    const type = interaction.options.getString('typ');
    const channel = interaction.options.getChannel('bewerbungschannel');

    try {
      await JobListing.create({
        guildId: interaction.guild.id,
        title,
        description,
        type,
        applicationChannelId: channel.id,
      });

      const embed = createEmbed({
        title: 'Stellenangebot erstellt ✅',
        color: COLORS.JOB,
        fields: [
          { name: 'Titel', value: title, inline: true },
          { name: 'Typ', value: type, inline: true },
          { name: 'Bewerbungschannel', value: `${channel}`, inline: true },
        ],
        description: `> ${description}`,
      });
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
