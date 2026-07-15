import os
from pathlib import Path
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

load_dotenv(Path(__file__).parent / '.env')

SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY')
SENDER_EMAIL = os.getenv('SENDER_EMAIL')


def _send_email(to_email, subject, html_content):
    if not SENDGRID_API_KEY or not SENDER_EMAIL:
        print('SendGrid not configured, skipping email to ' + str(to_email))
        return False
    if not to_email:
        print('No recipient email provided, skipping notification')
        return False

    message = Mail(
        from_email=SENDER_EMAIL,
        to_emails=to_email,
        subject=subject,
        html_content=html_content,
    )
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        print('Email sent to ' + to_email + ' status=' + str(response.status_code))
        return True
    except Exception as e:
        print('Failed to send email to ' + str(to_email) + ': ' + str(e))
        return False


def send_order_confirmation(to_email, order_id, total_amount, items, shipping_address):
    if not to_email:
        return False

    items_html = ''
    for item in items:
        items_html += (
            '<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">'
            + str(item.get('crop_name', 'Item'))
            + '</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">'
            + str(item.get('quantity', ''))
            + '</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">Rs. '
            + str(item.get('unit_price', ''))
            + '</td></tr>'
        )

    html = (
        '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">'
        '<h2 style="color:#2e7d32;">Order Confirmed!</h2>'
        '<p>Your order <strong>#' + str(order_id) + '</strong> has been placed successfully.</p>'
        '<table style="width:100%;border-collapse:collapse;margin:16px 0;">'
        '<thead><tr style="background:#f5f5f5;">'
        '<th style="padding:6px 10px;text-align:left;">Item</th>'
        '<th style="padding:6px 10px;text-align:left;">Qty</th>'
        '<th style="padding:6px 10px;text-align:left;">Price</th>'
        '</tr></thead><tbody>' + items_html + '</tbody></table>'
        '<p><strong>Total: Rs. ' + str(total_amount) + '</strong></p>'
        '<p><strong>Delivery Address:</strong><br>' + str(shipping_address) + '</p>'
        '<p style="color:#777;font-size:13px;margin-top:24px;">Thank you for shopping with KisaanConnect.</p>'
        '</div>'
    )

    return _send_email(to_email, 'Order Confirmation - #' + str(order_id), html)


def send_order_status_update(to_email, order_id, new_status):
    if not to_email:
        return False

    html = (
        '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">'
        '<h2 style="color:#2e7d32;">Order Status Updated</h2>'
        '<p>Your order <strong>#' + str(order_id) + '</strong> status has been updated to:</p>'
        '<p style="font-size:18px;font-weight:bold;color:#2e7d32;text-transform:capitalize;">' + str(new_status) + '</p>'
        '<p style="color:#777;font-size:13px;margin-top:24px;">Thank you for shopping with KisaanConnect.</p>'
        '</div>'
    )

    return _send_email(to_email, 'Order #' + str(order_id) + ' - Status Updated to ' + str(new_status), html)
