from app.database import supabase

email = input("Enter test user email: ")
password = input("Enter test user password: ")

response = supabase.auth.sign_in_with_password({
    "email": email,
    "password": password
})

print("\nAccess Token:")
print(response.session.access_token)