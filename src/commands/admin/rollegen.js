const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const OwnRoleRequest = require('../../models/OwnRoleRequest');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rollegen')
    .setDescription('Genehmige eine eigene Rollen-Anfrage')
    .addStringOption(opt =>
      opt.setName('id').setDescription('Anfrage-ID').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction) {
    const requestId = interaction.options.getString('id');

    const request = await OwnRoleRequest.findById(requestId);
    if (!request) {
      return interaction.reply({ content: '❌ Anfrage nicht gefunden.', ephemeral: true });
    }
    if (request.status !== 'pending') {
      return interaction.reply({ content: '❌ Diese Anfrage wurde bereits bearbeitet.', ephemeral: true });
    }

    const approvalService = require('../../services/approvalService');
    const coinService = require('../../services/coinService');
    const xpService = require('../../services/xpService');

    try {
      await coinService.removeCoins(request.guildId, request.userId, request.cost, 'own_role', `Eigene Rolle: ${request.roleName}`);
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }

    try {
      const role = await interaction.guild.roles.create({
        name: request.roleName,
        color: request.roleColor,
        reason: `Eigene Rolle für <@${request.userId}>`,
      });

      const member = await interaction.guild.members.fetch(request.userId);
      await member.roles.add(role);

      request.roleId = role.id;
      const user = await xpService.getOrCreateUser(request.guildId, request.userId);
      user.ownRoleCount += 1;
      await user.save();
    } catch (err) {
      return interaction.reply({ content: `❌ Rolle konnte nicht erstellt werden: ${err.message}`, ephemeral: true });
    }

    request.status = 'approved';
    request.reviewedBy = interaction.user.id;
    request.reviewedAt = new Date();
    await request.save();

    await interaction.reply({
      content: `Rolle **${request.roleName}** für <@${request.userId}> genehmigt und erstellt. ✅`,
    });
  },
};
