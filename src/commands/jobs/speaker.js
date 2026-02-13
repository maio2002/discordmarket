const { SlashCommandBuilder } = require('discord.js');
const jobService = require('../../services/jobService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('speaker')
    .setDescription('Speaker-Session verwalten')
    .addSubcommand(sub =>
      sub.setName('start').setDescription('Starte eine Speaker-Session')
    )
    .addSubcommand(sub =>
      sub.setName('beenden').setDescription('Beende deine Speaker-Session')
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.voice.channelId) {
        return interaction.reply({
          content: '❌ Du musst in einem Voice-Channel sein.',
          ephemeral: true,
        });
      }

      try {
        const session = await jobService.startSpeakerSession(
          interaction.guild.id,
          interaction.user.id,
          member.voice.channelId
        );

        const embed = createEmbed({
          title: '🎤 Speaker-Session gestartet',
          color: COLORS.JOB,
          fields: [
            { name: 'Speaker', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Channel', value: `<#${member.voice.channelId}>`, inline: true },
          ],
          footer: 'Nutze /speaker beenden um die Session zu beenden.',
        });

        await interaction.reply({ embeds: [embed] });
      } catch (err) {
        await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
      }
    }

    if (sub === 'beenden') {
      try {
        const session = await jobService.endSpeakerSession(
          interaction.guild.id,
          interaction.user.id,
          interaction.guild
        );

        const embed = createEmbed({
          title: '🎤 Speaker-Session beendet',
          color: COLORS.SUCCESS,
          fields: [
            { name: 'Dauer', value: `${Math.round((session.endTime - session.startTime) / 60_000)} Minuten`, inline: true },
            { name: 'Zuhörer (Durchschnitt)', value: `${session.avgAudience}`, inline: true },
            { name: 'Verdient', value: formatCoins(session.coinsAwarded), inline: true },
          ],
        });

        await interaction.reply({ embeds: [embed] });
      } catch (err) {
        await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
      }
    }
  },
};
