const emailTemplate = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme ton email — MyTrack</title>
</head>
<body style="margin: 0; padding: 0; background-color: #111214; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #111214; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #1C1D22; border: 1px solid #282A30; border-radius: 28px; padding: 40px 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Logo & Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="width: 54px; height: 54px; background-color: #D4F63D; border-radius: 18px; color: #000000; font-weight: 900; font-size: 26px; line-height: 54px; text-align: center; display: inline-block;">
                M
              </div>
              <h1 style="margin: 16px 0 6px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF;">
                Active ton compte MyTrack
              </h1>
              <p style="margin: 0; font-size: 13px; color: #8E929E;">
                Ton espace de performance & suivi d'habitudes
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding-bottom: 24px;">
              <div style="height: 1px; background-color: #282A30; width: 100%;"></div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="font-size: 14px; line-height: 1.6; color: #D1D5DB; padding-bottom: 28px;">
              <p style="margin: 0 0 14px 0;">
                Salut ! Tu es à un clic de commencer à suivre tes habitudes et propulser ton momentum au niveau supérieur.
              </p>
              <p style="margin: 0;">
                Clique sur le bouton ci-dessous pour confirmer ton adresse email et accéder directement à ton tableau de bord :
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; background-color: #D4F63D; color: #000000; font-size: 14px; font-weight: 800; text-decoration: none; padding: 15px 36px; border-radius: 16px; box-shadow: 0 4px 20px rgba(212, 246, 61, 0.35); text-align: center;">
                Confirmer mon email →
              </a>
            </td>
          </tr>

          <!-- Features Box -->
          <tr>
            <td style="padding-bottom: 24px;">
              <div style="background-color: #252830; border: 1px solid #343740; border-radius: 20px; padding: 18px 20px;">
                <div style="font-size: 12px; font-weight: 700; color: #D4F63D; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Ce qui t'attend sur MyTrack :
                </div>
                <div style="font-size: 12px; color: #E5E7EB; line-height: 1.7;">
                  • ⚡ Suivi de streak & habitudes quotidiennes<br>
                  • 📈 Graphiques dynamiques & momentum de performance<br>
                  • 🤖 Coach IA connecté à tes progrès réels
                </div>
              </div>
            </td>
          </tr>

          <!-- Fallback Link -->
          <tr>
            <td style="font-size: 11px; color: #6B7280; line-height: 1.5; padding-top: 10px; border-top: 1px solid #282A30;">
              Si le bouton ne fonctionne pas, copie et colle ce lien dans ton navigateur :<br>
              <a href="{{ .ConfirmationURL }}" style="color: #D4F63D; word-break: break-all; text-decoration: underline;">{{ .ConfirmationURL }}</a>
            </td>
          </tr>

        </table>

        <!-- Footer Notice -->
        <table role="presentation" width="100%" style="max-width: 520px; margin-top: 20px;" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="font-size: 11px; color: #4B5563;">
              Si tu n'as pas créé de compte sur MyTrack, tu peux ignorer cet email en toute sécurité.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

const payload = {
  site_url: "https://mytrack-nine.vercel.app",
  uri_allow_list: "https://mytrack-nine.vercel.app/**,http://localhost:3000/**,https://*.vercel.app/**",
  mailer_subjects_confirmation: "Active ton compte MyTrack 🚀",
  mailer_templates_confirmation_content: emailTemplate,
};

console.log(JSON.stringify(payload));
