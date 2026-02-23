const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const coinService = require('../../services/coinService');
const { isAdmin } = require('../../utils/permissions');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('willkommensgeschenk')
    .setDescription('Sende allen Mitgliedern 100 Coins und eine Bot-Einführung')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: '❌ Du benötigst Admin-Rechte für diesen Befehl.',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const GIFT_AMOUNT = 100;
    const guild = interaction.guild;

    try {
      // Lade alle Mitglieder
      const members = await guild.members.fetch();
      const realMembers = members.filter(m => !m.user.bot);

      let successCount = 0;
      let errorCount = 0;

      // Vergebe Coins an alle Mitglieder
      for (const [, member] of realMembers) {
        try {
          await coinService.addCoins(
            guild.id,
            member.id,
            GIFT_AMOUNT,
            'admin_give',
            'Willkommensgeschenk'
          );
          successCount++;

          // Sende Einführungsnachricht per DM
          try {
            const introEmbed = createEmbed({
              title: '🎁 Willkommensgeschenk!',
              description: `Du hast **${formatCoins(GIFT_AMOUNT)}** als Willkommensgeschenk erhalten!`,
              color: COLORS.SUCCESS,
              fields: [
                {
                  name: '💰 Economy-System',
                  value: '> Verdiene Coins durch Chatten und Voice-Aktivität\n> Kaufe Rollen im Shop\n> Handle mit anderen Mitgliedern',
                  inline: false,
                },
                {
                  name: '📊 Level-System',
                  value: '> Sammle XP durch Aktivität\n> Steige im Level auf\n> Schalte Rang-Rollen frei',
                  inline: false,
                },
                {
                  name: '🛒 Shop & Marktplatz',
                  value: '> Nutze `/shop` für Rollen, Services, Quests und Jobs\n> Nutze `/markt` für Handelsangebote\n> Nutze `/postfach` für Anfragen und Nachrichten',
                  inline: false,
                },
                {
                  name: '💼 Jobs & Quests',
                  value: '> Bewerbe dich auf Jobs für wöchentliches Gehalt\n> Nimm Quests an für einmalige Belohnungen\n> Biete eigene Services an',
                  inline: false,
                },
                {
                  name: '📈 Nützliche Befehle',
                  value: '> `/rank` - Zeigt dein Level und Coins\n> `/leaderboard` - Top-Rangliste\n> `/shop` - Öffnet den Shop\n> `/markt` - Zeigt Handelsangebote\n> `/wöchentlich` - Hole deinen wöchentlichen Bonus',
                  inline: false,
                },
              ],
              footer: 'Viel Spaß auf dem Server! 🎉',
            });

            await member.send({ embeds: [introEmbed] });
          } catch (dmError) {
            // DM fehlgeschlagen (z.B. DMs deaktiviert), ignorieren
          }
        } catch (err) {
          errorCount++;
        }
      }

      // Bestätigungsnachricht
      const resultEmbed = createEmbed({
        title: '🎁 Willkommensgeschenk verteilt!',
        color: COLORS.SUCCESS,
        fields: [
          { name: 'Betrag pro Person', value: formatCoins(GIFT_AMOUNT), inline: true },
          { name: 'Erfolgreich', value: `${successCount} Mitglieder`, inline: true },
          { name: 'Fehler', value: `${errorCount}`, inline: true },
          { name: 'Gesamt vergeben', value: formatCoins(GIFT_AMOUNT * successCount), inline: false },
        ],
        footer: 'Einführungsnachricht wurde per DM an alle Mitglieder gesendet.',
      });

      return interaction.editReply({ embeds: [resultEmbed] });
    } catch (err) {
      return interaction.editReply({
        content: `❌ Fehler beim Verteilen: ${err.message}`,
      });
    }
  },
};
