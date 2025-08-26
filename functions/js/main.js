// public/js/main.js
async function fetchUsers() {
  const response = await fetch('/api/users');
  const users = await response.json();
  console.log(users);
}
