const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const JobListing = require('../../models/JobListing');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

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
    .addRoleOption(opt =>
      opt.setName('rolle').setDescription('Discord-Rolle, die der Bewerber erhält').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('gehalt').setDescription('Wöchentliches Gehalt in Coins').setRequired(true).setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const title = interaction.options.getString('titel');
    const description = interaction.options.getString('beschreibung');
    const role = interaction.options.getRole('rolle');
    const salary = interaction.options.getInteger('gehalt');

    try {
      await JobListing.create({
        guildId: interaction.guild.id,
        title,
        description,
        roleId: role.id,
        salary,
      });

      const embed = createEmbed({
        title: 'Stellenangebot erstellt ✅',
        color: COLORS.JOB,
        fields: [
          { name: 'Titel', value: title, inline: true },
          { name: 'Rolle', value: `<@&${role.id}>`, inline: true },
          { name: 'Gehalt/Woche', value: formatCoins(salary), inline: true },
        ],
        description: `> ${description}`,
      });
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
