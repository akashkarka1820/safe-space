# SafeSpace - Cyberbullying Detection Platform

SafeSpace is a full-stack social platform with integrated Machine Learning pipelines for real-time text and image cyberbullying detection.

## Features

- **Real-Time Text Moderation**: Comments are instantly checked against text-classification models (XGBoost, SVM, Logistic Regression, SGD).
- **Meme & Image Analysis**: Images uploaded as "memes" are scanned by deep learning models (MobileNetV2, ResNet50, VGG16, EfficientNet) to detect abusive imagery.
- **Admin Dashboard**: Visual analytics using Chart.js to monitor platform health, active users, strikes, and champion model performance metrics.
- **Strike System**: Users receiving strikes for toxic behavior are temporarily or permanently blocked depending on the severity and frequency.
- **User Dashboard**: Users can track their posts, receive a personalized hate measure score, and monitor their active strikes.

## Tech Stack

- **Backend**: FastAPI (Python)
- **Database**: SQLite (SQLAlchemy ORM)
- **Frontend**: Vanilla HTML/JS/CSS with Chart.js
- **Machine Learning**: 
  - *Text*: Scikit-learn, XGBoost, Pandas, Numpy
  - *Vision*: TensorFlow/Keras (MobileNetV2, ResNet50)
- **Security**: JWT Authentication (PyJWT, Passlib)

## Installation

1. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```

2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

Start the local server using Uvicorn:

```bash
uvicorn main:app --reload
```

Then, visit the application in your browser:
- **Main App**: `http://localhost:8000/`
- **Admin Dashboard**: `http://localhost:8000/admin` (Requires Admin authentication)

## Default Users

The first registered user is automatically granted an `admin` role.
