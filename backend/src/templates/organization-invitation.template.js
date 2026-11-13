function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

export function createOrganizationInvitationTemplate({
  name,
  organizationName,
  role,
  invitationUrl,
}) {
  if (!invitationUrl) {
    throw new Error("Invitation URL is required.");
  }

  const parsedUrl = new URL(invitationUrl);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Invalid invitation URL.");
  }

  const safeName = escapeHtml(name || "there");
  const safeOrganizationName = escapeHtml(organizationName);
  const safeRole = escapeHtml(role === "manager" ? "Manager" : "Sales Staff");
  const safeUrl = escapeHtml(parsedUrl.toString());

  const subject = `You're invited to join ${organizationName} on RetailFlow`;

  const text = `
Hello ${name || "there"},

You have been invited to join ${organizationName} on RetailFlow as a ${role}.

Accept your invitation using this link:

${parsedUrl.toString()}

This invitation will expire after 7 days.

If you were not expecting this invitation, you can ignore this email.

Regards,
RetailFlow Team
  `.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Organization Invitation - RetailFlow</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,sans-serif;color:#202124;">
  <div style="max-width:560px;margin:40px auto;padding:32px 24px;background-color:#ffffff;border-radius:12px;">
    <h1 style="margin:0 0 24px;text-align:center;color:#2563eb;font-size:26px;">
      RetailFlow
    </h1>

    <h2 style="font-size:21px;margin-bottom:16px;">
      You're invited!
    </h2>

    <p style="font-size:15px;line-height:1.6;">
      Hello ${safeName},
    </p>

    <p style="font-size:15px;line-height:1.6;">
      You have been invited to join
      <strong>${safeOrganizationName}</strong>
      on RetailFlow.
    </p>

    <p style="font-size:15px;line-height:1.6;">
      Your assigned role:
      <strong>${safeRole}</strong>
    </p>

    <div style="text-align:center;margin:30px 0;">
      <a
        href="${safeUrl}"
        style="display:inline-block;padding:14px 28px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:7px;font-weight:bold;"
      >
        Accept Invitation
      </a>
    </div>

    <p style="font-size:14px;line-height:1.6;color:#555555;">
      This invitation expires after <strong>7 days</strong>.
      You must sign in to your verified RetailFlow account using the
      invited email address to accept it.
    </p>

    <p style="font-size:13px;line-height:1.6;color:#666666;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>

    <p style="font-size:12px;line-height:1.6;word-break:break-all;">
      <a href="${safeUrl}" style="color:#2563eb;">${safeUrl}</a>
    </p>

    <hr style="border:none;border-top:1px solid #eeeeee;margin:28px 0;" />

    <p style="font-size:12px;color:#777777;line-height:1.6;">
      If you were not expecting this invitation, you can safely ignore this email.
    </p>

    <p style="font-size:13px;color:#555555;">
      Regards,<br />
      RetailFlow Team
    </p>
  </div>
</body>
</html>
  `.trim();

  return {
    subject,
    text,
    html,
  };
}
