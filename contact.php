<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // reCAPTCHA secret key (replace with your actual secret key from Google reCAPTCHA)
    $recaptcha_secret = "YOUR_SECRET_KEY";

    // The response token from the reCAPTCHA widget (passed in the form POST data)
    $recaptcha_response = $_POST['g-recaptcha-response'];

    // Verify the reCAPTCHA token with Google
    $response = file_get_contents("https://www.google.com/recaptcha/api/siteverify?secret=$recaptcha_secret&response=$recaptcha_response");
    $responseKeys = json_decode($response, true);

    // Check if reCAPTCHA verification was successful
    if ($responseKeys["success"]) {
        // reCAPTCHA passed, process the form data and send the email

        // Sanitize form input
        $name = htmlspecialchars($_POST['name']);
        $email = htmlspecialchars($_POST['email']);
        $message = htmlspecialchars($_POST['message']);

        // Email details
        $to = "contact@towcestervolleyball.co.uk";
        $subject = "New Contact Form Submission";
        $body = "Name: $name\nEmail: $email\nMessage:\n$message";
        $headers = "From: $email\r\nReply-To: $email\r\n";

        // Send the email
        if (mail($to, $subject, $body, $headers)) {
            // Success message
            echo "Message sent successfully!";
        } else {
            // Failure message
            echo "There was an error sending your message. Please try again later.";
        }
    } else {
        // reCAPTCHA failed
        echo "reCAPTCHA verification failed. Please try again.";
    }
}
?>
