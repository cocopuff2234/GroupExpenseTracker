from flask import Flask, request, jsonify
from PIL import Image, ImageFilter, ImageOps
import pytesseract
import re
import shutil
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024


def preprocess_image(image):
    gray = ImageOps.grayscale(image)
    scaled = gray.resize((gray.width * 2, gray.height * 2), Image.Resampling.LANCZOS)
    contrasted = ImageOps.autocontrast(scaled)
    sharpened = contrasted.filter(ImageFilter.SHARPEN)

    return sharpened.point(lambda pixel: 255 if pixel > 165 else 0)


def extract_amount(text):
    lines = text.split('\n')

    total_keywords = ['total', 'amount', 'balance', 'grand total', 'paid', 'due']
    amount_pattern = r'\$?\s*(\d{1,4}(?:,\d{3})*\.\d{2})'

    for line in reversed(lines):
        lower = line.lower()

        if any(keyword in lower for keyword in total_keywords):
            match = re.search(amount_pattern, line)
            if match:
                return match.group(1).replace(',', '')

    matches = re.findall(amount_pattern, text)
    return matches[-1].replace(',', '') if matches else None


def extract_date(text):
    """
    Try multiple common date formats
    """
    patterns = [
        r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',      
        r'\b\d{4}-\d{2}-\d{2}\b',            
        r'\b[A-Za-z]{3,9}\s\d{1,2},\s\d{4}\b'  
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)

    return None


@app.route('/ocr', methods=['POST'])
def ocr_receipt():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    file = request.files['image']

    if file.mimetype not in ['image/png', 'image/jpeg', 'image/jpg']:
        return jsonify({'error': 'Unsupported file type'}), 400

    try:
        image = Image.open(file.stream)
    except Exception:
        return jsonify({'error': 'Invalid image file'}), 400

    if not shutil.which('tesseract'):
        return jsonify({
            'error': 'Tesseract OCR is not installed. Install it with: brew install tesseract'
        }), 500

    try:
        processed = preprocess_image(image)

        text = pytesseract.image_to_string(
            processed,
            config='--oem 3 --psm 6'
        )

        amount = extract_amount(text)
        date = extract_date(text)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    return jsonify({
        'rawText': text,
        'amount': amount,
        'date': date
    })


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5050, debug=False, use_reloader=False)
