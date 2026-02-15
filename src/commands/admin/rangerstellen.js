const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { LEVEL } = require('../../constants');
const GuildConfig = require('../../models/GuildConfig');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rangerstellen')
    .setDescription('Erstellt automatisch alle 9 Rang-Rollen')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const rankRoleIds = [];

    for (const rank of LEVEL.RANKS) {
      // Prüfen ob Rolle mit dem Namen schon existiert
      let role = guild.roles.cache.find(r => r.name === rank.name);

      if (!role) {
        role = await guild.roles.create({
          name: rank.name,
          reason: 'Rang-System automatisch erstellt',
        });
      }

      rankRoleIds.push(role.id);
    }

    // In GuildConfig speichern
    await GuildConfig.findOneAndUpdate(
      { guildId: guild.id },
      { rankRoleIds },
      { upsert: true }
    );

    const lines = LEVEL.RANKS.map((rank, i) =>
      `**${i + 1}.** <@&${rankRoleIds[i]}> — ${rank.cost.toLocaleString('de-DE')} Coins`
    );

    const embed = createEmbed({
      title: '✅ Rang-Rollen erstellt',
      description: lines.join('\n'),
      color: COLORS.SUCCESS,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
