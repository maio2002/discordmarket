const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const OwnRoleRequest = require('../../models/OwnRoleRequest');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolleabl')
    .setDescription('Lehne eine eigene Rollen-Anfrage ab')
    .addStringOption(opt =>
      opt.setName('id').setDescription('Anfrage-ID').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('grund').setDescription('Ablehnungsgrund')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction) {
    const requestId = interaction.options.getString('id');
    const reason = interaction.options.getString('grund') || 'Kein Grund angegeben';

    const request = await OwnRoleRequest.findById(requestId);
    if (!request) {
      return interaction.reply({ content: '❌ Anfrage nicht gefunden.', ephemeral: true });
    }
    if (request.status !== 'pending') {
      return interaction.reply({ content: '❌ Diese Anfrage wurde bereits bearbeitet.', ephemeral: true });
    }

    request.status = 'denied';
    request.reviewedBy = interaction.user.id;
    request.reviewedAt = new Date();
    request.denyReason = reason;
    await request.save();

    try {
      const user = await interaction.client.users.fetch(request.userId);
      await user.send(`Deine Anfrage für die Rolle **${request.roleName}** wurde abgelehnt.\nGrund: ${reason}`);
    } catch {}

    await interaction.reply({
      content: `Rollen-Anfrage **${request.roleName}** abgelehnt. ✅`,
    });
  },
};
