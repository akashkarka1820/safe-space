import os
import pickle
import numpy as np

MODEL_DIR = r"C:\Users\saira\safespace\ml\models"

text_model = None
text_vectorizer = None
image_model = None

# Initialize Text Model Champion (SVM or Logistic are fast. Using svm here)
def init_text_model():
    global text_model, text_vectorizer
    try:
        if os.path.exists(os.path.join(MODEL_DIR, "svm.pkl")) and os.path.exists(os.path.join(MODEL_DIR, "tfidf_vectorizer.pkl")):
            with open(os.path.join(MODEL_DIR, "svm.pkl"), "rb") as f:
                text_model = pickle.load(f)
            with open(os.path.join(MODEL_DIR, "tfidf_vectorizer.pkl"), "rb") as f:
                text_vectorizer = pickle.load(f)
    except Exception as e:
        print(f"Error loading text model: {e}")

# Initialize Image Model Champion (MobileNetV2 is fast)
def init_image_model():
    global image_model
    try:
        if os.path.exists(os.path.join(MODEL_DIR, "mobilenetv2.h5")):
            # Import tf locally to avoid slowing down startup if inference is rarely used
            import tensorflow as tf
            image_model = tf.keras.models.load_model(os.path.join(MODEL_DIR, "mobilenetv2.h5"))
    except Exception as e:
        print(f"Error loading image model: {e}")

# Load models safely
init_text_model()
try:
    init_image_model()
except Exception:
    pass

def is_cyberbullying_text(text: str) -> bool:
    if text_model is None or text_vectorizer is None:
        # Fallback keyword logic if models missing
        toxic_words = ["hate", "ugly", "whore", "idiot", "kill", "dumb", "stupid"]
        return any(w in text.lower() for w in toxic_words)
    
    vec = text_vectorizer.transform([text])
    
    if hasattr(text_model, "predict_proba"):
        probs = text_model.predict_proba(vec)
        # Because the training dataset was heavily biased (84% cyberbullying to 16% neutral),
        # neutral phrases like 'hi how are you' default mathematically to ~70%-84% positivity.
        # We enforce a strict > 0.90 threshold to effectively classify true positives!
        return bool(probs[0][1] > 0.90)
    else:
        pred = text_model.predict(vec)
        return bool(pred[0] == 1)

def is_cyberbullying_image(image_path: str) -> bool:
    if image_model is None:
        # Fallback simple logic
        return False
    
    import tensorflow as tf
    try:
        img = tf.keras.preprocessing.image.load_img(image_path, target_size=(224, 224))
        img_array = tf.keras.preprocessing.image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0) / 255.0
        pred = image_model.predict(img_array)
        return bool(pred[0][0] > 0.5)
    except Exception as e:
        print(f"Inference error on image {image_path}: {e}")
        return False
