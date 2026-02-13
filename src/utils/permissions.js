const { PermissionFlagsBits } = require('discord.js');

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function isModerator(member) {
  return member.permissions.has(PermissionFlagsBits.ManageGuild) || isAdmin(member);
}

async function isTeamMember(member) {
  return member.permissions.has(PermissionFlagsBits.ManageRoles) || isAdmin(member);
}

module.exports = { isAdmin, isModerator, isTeamMember };
