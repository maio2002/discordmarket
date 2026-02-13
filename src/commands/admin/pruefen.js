const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const jobService = require('../../services/jobService');
const GuildConfig = require('../../models/GuildConfig');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pruefen')
    .setDescription('Prüfe einen Nutzer (Examiner)')
    .addUserOption(opt =>
      opt.setName('nutzer').setDescription('Zu prüfender Nutzer').setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('ergebnis')
        .setDescription('Prüfungsergebnis')
        .setRequired(true)
        .addChoices(
          { name: 'Bestanden', value: 'bestanden' },
          { name: 'Mittle Ding', value: 'mittle_ding' },
          { name: 'Verkackt', value: 'verkackt' }
        )
    )
    .addStringOption(opt =>
      opt.setName('notizen').setDescription('Anmerkungen zur Prüfung')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const target = interaction.options.getUser('nutzer');
    const outcome = interaction.options.getString('ergebnis');
    const notes = interaction.options.getString('notizen');

    const job = await jobService.getJob(interaction.guild.id, interaction.user.id);
    if (!job || job.type !== 'examiner') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ Nur Examiner und Admins können Prüfungen durchführen.',
          ephemeral: true,
        });
      }
    }

    try {
      const exam = await jobService.recordExamination(
        interaction.guild.id,
        interaction.user.id,
        target.id,
        outcome,
        notes
      );

      const outcomeLabels = {
        bestanden: '✅ Bestanden',
        mittle_ding: '🟡 Mittle Ding',
        verkackt: '❌ Verkackt',
      };

      const embed = createEmbed({
        title: 'Prüfungsergebnis',
        color: outcome === 'bestanden' ? COLORS.SUCCESS : outcome === 'verkackt' ? COLORS.ERROR : COLORS.WARNING,
        fields: [
          { name: 'Prüfling', value: `<@${target.id}>`, inline: true },
          { name: 'Prüfer', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Ergebnis', value: outcomeLabels[outcome], inline: true },
          { name: 'Coins vergeben', value: formatCoins(exam.coinsAwarded), inline: true },
          ...(notes ? [{ name: 'Notizen', value: notes, inline: false }] : []),
        ],
      });

      const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
      setTimeout(() => reply.delete().catch(() => {}), 15_000);

      const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
      if (config?.logChannelId) {
        const logChannel = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
        if (logChannel) {
          const logEmbed = createEmbed({
            title: 'Prüfungsprotokoll',
            color: outcome === 'bestanden' ? COLORS.SUCCESS : outcome === 'verkackt' ? COLORS.ERROR : COLORS.WARNING,
            fields: [
              { name: 'Prüfling', value: `<@${target.id}>`, inline: true },
              { name: 'Prüfer', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Ergebnis', value: outcomeLabels[outcome], inline: true },
              { name: 'Coins vergeben', value: formatCoins(exam.coinsAwarded), inline: true },
              ...(notes ? [{ name: 'Notizen', value: notes, inline: false }] : []),
            ],
            footer: `Prüfung durchgeführt am ${new Date().toLocaleString('de-DE')}`,
          });
          await logChannel.send({ embeds: [logEmbed] });
        }
      }
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
