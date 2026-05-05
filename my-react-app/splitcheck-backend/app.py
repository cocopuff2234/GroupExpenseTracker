from flask import Flask, request, jsonify
from PIL import Image
import pytesseract
import numpy as np
import cv2
import re

app = Flask(__name__)

app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024


def preprocess_image(image):
    img = np.array(image)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)[1]

    return thresh


def extract_amount(text):
    """
    Try to find the total amount from receipt text.
    Strategy:
    - Look for currency-like values
    - Return the LAST one (usually total)
    """
    matches = re.findall(r'\$?\d+\.\d{2}', text)

    if not matches:
        return None

    return matches[-1] 


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