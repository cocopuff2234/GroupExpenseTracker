from flask import Flask, request, jsonify
from PIL import Image
import pytesseract
import numpy as np
import cv2
import re
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024


def preprocess_image(image):
    img = np.array(image)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Reduce noise
    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    # Adaptive threshold (better than fixed 150)
    thresh = cv2.adaptiveThreshold(
        blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        11,
        2
    )

    return thresh


def extract_amount(text):
    lines = text.split('\n')

    total_keywords = ['total', 'amount', 'balance', 'grand total']

    for line in reversed(lines):
        lower = line.lower()

        if any(keyword in lower for keyword in total_keywords):
            match = re.search(r'\d+\.\d{2}', line)
            if match:
                return match.group(0)

    matches = re.findall(r'\d+\.\d{2}', text)
    return matches[-1] if matches else None


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
    app.run(debug=True)