from ml.inference import is_cyberbullying_text, text_model, text_vectorizer
print("Threshold logic gives:", is_cyberbullying_text("hey how are you"))
probs = text_model.predict_proba(text_vectorizer.transform(["hey how are you"]))
print("Probabilities:", probs)
