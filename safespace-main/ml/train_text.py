import pandas as pd
import sqlite3
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.linear_model import SGDClassifier, LogisticRegression
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from datetime import datetime
import pickle
import os

DATASET_PATH = r"C:\Users\saira\Downloads\cyberbullying_tweets.csv"
DB_PATH = r"C:\Users\saira\safespace\app.db"
MODEL_DIR = r"C:\Users\saira\safespace\ml\models"

if not os.path.exists(MODEL_DIR):
    os.makedirs(MODEL_DIR)

def save_metric_to_db(model_name, model_type, acc, prec, rec, f1):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Check if table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='model_metrics'")
    if cursor.fetchone() is None:
        pass # The backend will create the table through SQLAlchemy
    else:
        cursor.execute('''
            INSERT INTO model_metrics (model_name, model_type, accuracy, precision, recall, f1_score, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (model_name, model_type, acc, prec, rec, f1, datetime.utcnow()))
        conn.commit()
    conn.close()

def train_text_models():
    print("Loading text dataset...")
    df = pd.read_csv(DATASET_PATH)
    # Binary classification: cyberbullying vs not_cyberbullying
    df['label'] = df['cyberbullying_type'].apply(lambda x: 0 if x == 'not_cyberbullying' else 1)
    
    # Subsampling for speed during realistic demo. Adjust if full train is needed.
    if len(df) > 10000:
        df = df.sample(10000, random_state=42)
        
    X_train, X_test, y_train, y_test = train_test_split(df['tweet_text'], df['label'], test_size=0.2, random_state=42)
    
    print("Vectorizing Text...")
    vectorizer = TfidfVectorizer(max_features=5000)
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)
    
    with open(os.path.join(MODEL_DIR, "tfidf_vectorizer.pkl"), "wb") as f:
        pickle.dump(vectorizer, f)
        
    models = {
        "svm": SVC(kernel='linear', probability=True),
        "sgd": SGDClassifier(loss='log_loss'),
        "logistic": LogisticRegression(max_iter=1000),
        "xgboost": XGBClassifier(use_label_encoder=False, eval_metric='logloss')
    }
    
    for name, model in models.items():
        print(f"Training {name}...")
        model.fit(X_train_vec, y_train)
        
        preds = model.predict(X_test_vec)
        
        acc = accuracy_score(y_test, preds)
        prec = precision_score(y_test, preds, zero_division=0)
        rec = recall_score(y_test, preds, zero_division=0)
        f1 = f1_score(y_test, preds, zero_division=0)
        
        print(f"{name} Results - Acc: {acc:.2f}, Prec: {prec:.2f}, Rec: {rec:.2f}")
        
        # Save Model
        with open(os.path.join(MODEL_DIR, f"{name}.pkl"), "wb") as f:
            pickle.dump(model, f)
            
        # Save metrics
        save_metric_to_db(name, "text", acc, prec, rec, f1)

if __name__ == "__main__":
    train_text_models()
    print("Text model training complete.")
