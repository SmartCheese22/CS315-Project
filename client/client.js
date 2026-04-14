import axios from 'axios';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const serverUrl = 'http://localhost:8080'; // Adjust if needed
let userId = null; // Store logged-in user's ID


// Login / Register Menu
function showAuthMenu() {
    console.log("\n🔐 Welcome to the Library Management System.");
    console.log("1️⃣  Login");
    console.log("2️⃣  Register");
    console.log("3️⃣  Manager Login");
    console.log("4️⃣  Search for a book");
    console.log("5️⃣  Exit");
    

    rl.question("👉 Enter your choice: ", choice => {
        switch (choice) {
            case '1':
                login();
                break;
            case '2':
                register();
                break;
            case '3':
                managerLogin(); 
                break;
            case '4':
                searchBookMenu();
                break;
            case '5':
                console.log("👋  Exiting...");
                rl.close();
                break;
            default:
                console.log("❌  Invalid choice. Try again.");
                showAuthMenu();
        }
    });
}

// Login to library
function login() {
    rl.question("👤 Enter email: ", email => {
        rl.question("🔑 Enter Password: ", password => {
            // if (email === hardcodedUser.email && password === hardcodedUser.password) {
            //     userId = hardcodedUser.userId;
            //     console.log(`✅ Hardcoded Login Successful! Welcome, ${userId}.`);
            //     showMenu();
            //     return;
            // }
            axios.post(`${serverUrl}/user/login`, { email, password })
                .then(response => {
                    if (!response.data || !response.data.userId || !response.data.username) {
                        throw new Error("Invalid login response");
                    }
                    userId = response.data.userId;
                    console.log(`✅ Login Successful! Welcome, ${response.data.username}.`);
                    showMenu();
                })
                .catch(error => {
                    console.error("❌ Login Failed:", error.response?.data?.error || error.message);
                    showAuthMenu();
                });

        });
    });
}

// Register a new user with OTP verification
function register() {
    console.log("\n📝 Register a New Account");

    rl.question("📧 Enter your Email ID: ", email => {
        // Send OTP request
        axios.post(`${serverUrl}/user/send-otp`, { email })
            .then(() => {
                rl.question("📩 Enter the OTP you received: ", otp => {
                    // Verify OTP
                    axios.post(`${serverUrl}/user/verify-otp`, { email, otp })
                        .then(() => {
                            console.log("✅ OTP Verified! Proceeding with registration...");

                            rl.question("👤 Enter First Name: ", first_name => {
                                rl.question("👥 Enter Last Name: ", last_name => {
                                    rl.question("📱 Enter Mobile Number: ", mobile_no => {
                                        rl.question("🔑 Choose a Password: ", password => {

                                            const userData = { first_name, last_name, mobile_no, email, password };

                                            axios.post(`${serverUrl}/user/register`, userData)
                                                .then(response => {
                                                    console.log(`✅ Registration Successful! You can now log in.`);
                                                    showAuthMenu();
                                                })
                                                .catch(error => {
                                                    console.error("❌ Registration Failed:", error.response?.data?.message || error.message);
                                                    showAuthMenu();
                                                });

                                        });
                                    });
                                });
                            });

                        })
                        .catch(error => {
                            console.error("❌ OTP Verification Failed:", error.response?.data?.message || error.message);
                            showAuthMenu();
                        });
                });
            })
            .catch(error => {
                console.error("❌ Failed to Send OTP:", error.response?.data?.message || error.message);
                showAuthMenu();
            });
    });
}



// Menu
function showMenu() {
    console.log("\n📚 Library Management System");
    console.log("1️⃣  Search for a Book 🔍");
    console.log("2️⃣  Borrow a Book");
    console.log("3️⃣  Return a Book");
    console.log("4️⃣  Pay Fine 💰");
    console.log("5️⃣  Get Recommendations");
    console.log("6️⃣  View Most Liked Books");
    console.log("7️⃣  View Requested Books");
    console.log("8️⃣  Logout");
    rl.question("👉 Enter your choice: ", handleUserInput);
}

function handleUserInput(choice) {
    switch (choice) {
        case '1':
            searchBookMenu();
            break;
        case '2':
            rl.question("📖 Enter Book ID to borrow (you can find Book ID by searching for the book): ", bookId => borrowBook(bookId.trim()));
            break;
        case '3':
            showIssuedBooks();
            break;
        case '4':
            checkFine();
            break;
        case '5':
            getRecommendations();
            break;
        case '6':
            getMostLikedBooks();
            break;
        case '7':
            getRequestedBooks();
            break;
        case '8':
            console.log("👋 Logging out...");
            userId = null;
            showAuthMenu();
            break;
        default:
            console.log("❌ Invalid choice. Try again.");
            showMenu();
    }
}

function getRequestedBooks() {
    axios.get(`${serverUrl}/user/requested-books`, { params: { userId } })
        .then(response => {
            const books = response.data;

            if (books.length === 0) {
                console.log("📚 No requested books found.");
                showMenu();
            } else {
                console.log("\n📚 Your Requested Books:");
                books.forEach((book, index) => {
                    console.log(`${index + 1}. ${book.book_title} by ${book.authors} [Category: ${book.category_name}] (Book ID: ${book.book_id})`);
                });
            }

            // Ask the user whether they want to cancel any of their requests by entering the Book ID
            rl.question("\n❓ Do you want to cancel any of your requests? (yes/no): ", answer => {
                if (answer.toLowerCase() === 'yes') {
                    rl.question("📖 Enter the Book ID to cancel: ", bookId => {
                        axios.post(`${serverUrl}/user/cancel-request`, { userId, bookId })
                            .then(response => {
                                console.log(`✅ ${response.data.message}`);
                                showMenu();
                            })
                            .catch(error => {
                                console.error("⚠️ Error cancelling request:", error.response?.data?.message || error.message);
                                showMenu();
                            });
                    });
                } else {
                    showMenu();
                }
            });
        })
        .catch(error => {
            console.error("⚠️ Error fetching requested books:", error.message);
            showMenu();
        });

    
}

function managerMenu() {
    console.log("\n👨‍💼 Manager Menu");
    console.log("1️⃣  Register a New Manager");
    console.log("2️⃣  View Dashboard");
    console.log("3️⃣  Add Book");
    console.log("4️⃣  View Users Who Haven’t Returned Books");
    console.log("5️⃣  View Return Requests");
    console.log("6️⃣  Logout to Main Menu");

    rl.question("👉 Enter your choice: ", choice => {
        switch (choice) {
            case '1':
                registerManager();
                break;
            case '2':
                managerDashboard();
                break;
            case '3':
                addBook();
                break;
            case '4':
                usersNotReturned();
                break;
            case '5':
                returnRequests();
                break;
            case '6':
                showAuthMenu();
                break;
            default:
                console.log("❌ Invalid choice.");
                managerMenu();
        }
    });
}

function returnRequests() {
    axios.get(`${serverUrl}/manager/return-requests`)
        .then(response => {
            const requests = response.data;
            if (requests.length === 0) {
                console.log("✅ No return requests found.");
                managerMenu();
            } else {
                console.log("\n📚 Return Requests:");
                requests.forEach((request, index) => {
                    console.log(`${index + 1}. User ID: ${request.user_id}, Book ID: ${request.book_id}, Request Date: ${new Date(request.return_date).toLocaleDateString()} (Request ID: ${request.return_id})`);
                });
            }
            // Ask the manager to approve or reject a request
            rl.question("\n❓ Do you want to approve or reject any requests? (yes/no): ", answer => {
                if (answer.toLowerCase() === 'yes') {
                    rl.question("📖 Enter the Request ID to approve/reject: ", returnId => {
                        rl.question("✅ Approve or ❌ Reject? (approve/reject): ", action => {
                            axios.post(`${serverUrl}/manager/manage-return`, { returnId, action })
                                .then(response => {
                                    console.log(`✅ ${response.data.message}`);
                                    managerMenu();
                                })
                                .catch(error => {
                                    console.error("⚠️ Error handling request:", error.response?.data?.message || error.message);
                                    managerMenu();
                                });
                        });
                    });
                } else {
                    managerMenu();
                }
            });
        })
        .catch(err => {
            console.error("❌ " + (err.response?.data?.message || err.message));
            managerMenu();
        });
}

function managerLogin() {
    rl.question("📧 Manager Email: ", email => {
        rl.question("🔑 Password: ", password => {
            axios.post(`${serverUrl}/manager/login`, { email, password })
                .then(response => {
                    console.log("✅ " + response.data.message);
                    managerMenu();
                })
                .catch(err => {
                    console.error("❌ " + (err.response?.data?.message || err.message));
                    showAuthMenu();
                });
        });
    });
}

function registerManager() {
    rl.question("📧 Email: ", email => {
        rl.question("🔑 Password: ", password => {
            rl.question("📱 Mobile Number: ", mobile_number => {
                rl.question("👤 Name: ", name => {
                    axios.post(`${serverUrl}/manager/add-manager`, {
                        email, password, mobile_number, name
                    }).then(response => {
                        console.log("✅ " + response.data.message);
                        managerMenu();
                    }).catch(err => {
                        console.error("❌ " + (err.response?.data?.message || err.message));
                        managerMenu();
                    });
                });
            });
        });
    });
}

function managerDashboard() {
    axios.get(`${serverUrl}/manager/dashboard`)
        .then(response => {
            console.log("\n📊 Dashboard:");
            const data = response.data;
            console.log(`👥 Total Users: ${data.users.total_users}`);
            console.log(`📚 Total Books: ${data.books.total_books}`);
            console.log(`📖 Currently Issued Books: ${data.current_issues.total_issues}`);
            managerMenu();
        })
        .catch(err => {
            console.error("❌ " + (err.response?.data?.message || err.message));
            managerMenu();
        });
}

function addBook() {
    console.log("\n📚 Add a New Book");

    rl.question("📖 Title: ", title => {
        rl.question("🔢 Number of Authors: ", numAuthors => {
            numAuthors = parseInt(numAuthors);
            if (isNaN(numAuthors) || numAuthors <= 0) {
                console.error("❌ Invalid number of authors.");
                return managerMenu();
            }

            let authors = [];
            let i = 0;

            const askAuthor = () => {
                if (i < numAuthors) {
                    rl.question(`✍️ Author ${i + 1}: `, authorName => {
                        authors.push(authorName);
                        i++;
                        askAuthor();
                    });
                } else {
                    rl.question("📂 Category: ", category => {
                        rl.question("📅 Publication Year: ", publication_year_str => {
                            const publication_year = parseInt(publication_year_str);
                            if (isNaN(publication_year)) {
                                console.error("❌ Invalid publication year.");
                                return managerMenu();
                            }

                            rl.question("🏢 Publisher Name: ", publisher_name => {
                                rl.question("🗣️ Publication Language: ", publication_language => {
                                    rl.question("🏢 Floor Number: ", floor_no_str => {
                                        const floor_no = parseInt(floor_no_str);
                                        if (isNaN(floor_no)) {
                                            console.error("❌ Invalid floor number.");
                                            return managerMenu();
                                        }

                                        rl.question("📦 Shelf Number: ", shelf_no_str => {
                                            const shelf_no = parseInt(shelf_no_str);
                                            if (isNaN(shelf_no)) {
                                                console.error("❌ Invalid shelf number.");
                                                return managerMenu();
                                            }

                                            rl.question("🔢 Total Copies: ", copies_total_str => {
                                                const copies_total = parseInt(copies_total_str);
                                                if (isNaN(copies_total) || copies_total <= 0) {
                                                    console.error("❌ Invalid number of copies.");
                                                    return managerMenu();
                                                }

                                                axios.post(`${serverUrl}/manager/add-book`, {
                                                    title,
                                                    authors,
                                                    category,
                                                    publication_year,
                                                    publisher_name,
                                                    publication_language,
                                                    floor_no,
                                                    shelf_no,
                                                    copies_total
                                                }).then(response => {
                                                    console.log("✅ " + response.data.message);
                                                    managerMenu();
                                                }).catch(err => {
                                                    console.error("❌ " + (err.response?.data?.message || err.message));
                                                    managerMenu();
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                }
            };

            askAuthor();
        });
    });
}

function usersNotReturned() {
    axios.get(`${serverUrl}/manager/not-returned`)
        .then(response => {
            const users = response.data;
            if (users.length === 0) {
                console.log("✅ No pending returns.");
            } else {
                console.log("\nUsers with Unreturned Books:");
                users.forEach((entry, index) => {
                    console.log(`${index + 1}. User ID: ${entry.user_id}`);
                    console.log(`   Email: ${entry.email}`);
                    console.log(`   Phone: ${entry.mobile_no}`);
                    console.log(`   Book ID: ${entry.book_id}`);
                    console.log(`   Return Due Date: ${new Date(entry.return_date).toLocaleDateString()}\n`);
                });
            }
            managerMenu();
        })
        .catch(err => {
            console.error("Error: " + (err.response?.data?.message || err.message));
            managerMenu();
        });
}



// Search for books
function searchBookMenu() {
    console.log("\n🔎 Search Books");
    console.log("1️⃣  By Title");
    console.log("2️⃣  By Author");
    console.log("3️⃣  By Category");
    console.log("4️⃣  Back to Main Menu");

    rl.question("👉 Enter your search choice: ", choice => {
        switch (choice) {
            case '1':
                rl.question("📖 Enter book title: ", title => searchBooks('title', title));
                break;
            case '2':
                rl.question("👤 Enter author name: ", author => searchBooks('author', author));
                break;
            case '3':
                rl.question("📂 Enter category: ", category => searchBooks('category', category));
                break;
            case '4':
                if(!userId){
                    showAuthMenu();
                }else{
                    showMenu();
                }
                break;
            default:
                console.log("❌ Invalid choice. Try again.");
                searchBookMenu();
        }
    });
}

//search through fields.
function searchBooks(field, value) {
    axios.get(`${serverUrl}/book/search`, { params: { field, value } })
        .then(response => {
            if (response.data.length === 0) {
                console.log("⚠️ No books found.");
                return userId ? showMenu() : searchBookMenu();
            }

            console.log("\n🔍 Search Results:");
            response.data.forEach(book => {
                console.log(`Book ID = ${book.book_id}, ${book.book_title} by ${book.authors} [Category: ${book.category_name}] (${book.copies_available ? '✅ Available' : '❌ Borrowed'})`);
            });

            if (userId) {
                console.log(`\nWhat would you like to do?`);
                console.log(`1. Like a book`);
                console.log(`2. Dislike a book`);
                console.log(`3. Do nothing`);

                rl.question("Enter your choice (1/2/3): ", choice => {
                    choice = choice.trim();

                    if (choice === '3') return showMenu();

                    if (choice !== '1' && choice !== '2') {
                        console.log("⚠️ Invalid choice. Returning to menu.");
                        return showMenu();
                    }

                    rl.question("Enter the Book ID: ", input => {
                        const bookId = parseInt(input.trim(), 10);
                        if (isNaN(bookId)) {
                            console.log("⚠️ Invalid Book ID. Returning to menu.");
                            return showMenu();
                        }

                        const book = response.data.find(b => b.book_id === bookId);
                        if (!book) {
                            console.log("⚠️ Book not found. Returning to menu.");
                            return showMenu();
                        }

                        const book_title = book.book_title;

                        if (choice === '1') {
                            likeBook(bookId, book_title);
                        } else {
                            dislikeBook(bookId, book_title);
                        }
                    });
                });
            } else {
                searchBookMenu();
            }
        })
        .catch(error => {
            console.error("⚠️ Error searching books:", error.message);
            return userId ? showMenu() : searchBookMenu();
        });
}



// Like a book
function likeBook(bookId, book_title) {
    axios.post(`${serverUrl}/user/like`, { user_id: userId, book_id: bookId })
        .then(response => {
            console.log(`📌 You liked the Book: ${book_title}`);
            console.log(`✅ Book liked successfully!`);
            userId ? showMenu() : searchBookMenu();
        })
        .catch(error => {
            console.error("⚠️ Error liking the book:", error.response?.data?.error || error.message);
            userId ? showMenu() : searchBookMenu();
        });
}

function dislikeBook(bookId, book_title) {
    axios.post(`${serverUrl}/user/dislike`, { user_id: userId, book_id: bookId })
        .then(response => {
            console.log(`🗑️ You disliked the Book: ${book_title}`);
            console.log(`✅ ${response.data.message}`);
            userId ? showMenu() : searchBookMenu();
        })
        .catch(error => {
            const errMsg = error.response?.data?.error || error.message;
            console.error("⚠️ Error disliking the book:", errMsg);
            userId ? showMenu() : searchBookMenu();
        });
}

// Borrow a book
function borrowBook(input) {
    const bookId = parseInt(input, 10); 
    if (isNaN(bookId)) {  
        console.log("⚠️ Enter a valid Book ID (must be a number).");
        showMenu();
        return;
    }
    axios.post(`${serverUrl}/book/issue`, { bookId, userId })
        .then(response => {
            if (response.data.message === "No copies available.") {
                rl.question("⚠️ No copies available. Do you want to be added to the waitlist? (yes/no): ", answer => {
                    if (answer.toLowerCase() === 'yes') {
                        return addToWaitlist(bookId);
                    } else {
                        console.log("❌ Not added to waitlist.");
                        showMenu();
                    }
                });
            }
            else
            {
                console.log(`✔️ ${response.data.message}`);
                showMenu();
            }
        })
        .catch(error => {
            console.error(`⚠️ ${error.response.data.message}`);
            showMenu();
        });
}

function addToWaitlist(bookId) {
    axios.post(`${serverUrl}/book/request`, { bookId, userId })
        .then(response => {
            console.log(`✔️ ${response.data.message}`);
            showMenu();
        })
        .catch(error => {
            console.error(`⚠️ ${error.response.data.message}`);
            showMenu();
        });
}

// Show issued books & ask which to return
function showIssuedBooks() {
    axios.get(`${serverUrl}/book/issued-books`, { params: { userId } })
        .then(response => {
            const books = response.data;

            if (books.length === 0) {
                console.log("⚠️  No books issued to you.");
                showMenu();
                return;
            }

            console.log("\n📚 Your Issued Books:");
            books.forEach((book, index) => {
                console.log(`${index + 1}. ${book.book_title} by ${book.author_names} [Category: ${book.category_name}] (Book ID: ${book.book_id})`);
            });

            rl.question("\n🔄 Enter the Book ID you want to return: ", bookId => {
                returnBook(bookId);
            });
        })
        .catch(error => {
            console.error("⚠️  Error fetching issued books:", error.message);
            showMenu();
        });
}

// Return a book
function returnBook(input) {
    const bookId = parseInt(input, 10); 
    if (isNaN(bookId)) {  
        console.log("⚠️ Enter a valid Book ID (must be a number).");
        showMenu();
        return;
    }

    axios.post(`${serverUrl}/book/request-return`, { bookId, userId })
        .then(response => {
            console.log(`⚠️ ${response.data.message}`);
            showMenu();
        })
        .catch(error => {
            console.error(`⚠️ Error message: ${error.response?.data?.error || error.message}`);
            showMenu();
        });
}

// // Check fine
function checkFine() {
    axios.get(`${serverUrl}/user/fine`, { params: { userId } })
        .then(response => {
            const fines = response.data; 
            if (!fines || fines.length === 0) {
                console.log("✅ No outstanding fines.");
                showMenu();
                return;
            }

            console.log("\n💰 Outstanding Fines:");
            let totalFine = 0;
            fines.forEach(fine => {
                console.log(`🔹 Fine ID: ${fine.fine_due_id} | Amount: ₹${fine.fine_amount} | Reason: ${fine.book_title}`);
                totalFine += fine.fine_amount;
            });

            console.log(`\n💵 Total Fine Amount: ₹${totalFine}`);
            rl.question(
                "⚠️  Do you want to: \n" +
                "(1) Pay Total Fine \n" +
                "(2) Pay Individually \n" +
                "(3) Go Back\n" +
                "Enter 1, 2, or 3: ",
                choice => {
                    if (choice === '1') {
                        confirmPayFine(totalFine);
                    } else if (choice === '2') {
                        payIndividualFine(fines);
                    } else if (choice === '3') {
                        console.log("🔙 Going back to the menu.");
                        showMenu();
                    } else {
                        console.log("❌ Invalid choice. Returning to menu.");
                        showMenu();
                    }
                }
            );
        })
        .catch(error => {
            console.error("⚠️  Error checking fine:", error.message);
            showMenu();
        });
}

// Confirm before paying total fine or else you will be homeless
function confirmPayFine(amount) {
    rl.question(`⚠️  Confirm payment of ₹${amount}? (yes/no): `, answer => {
        if (answer.toLowerCase() === 'yes') {
            payFine(null); // Passing null to make the value 0 ante cleared
        } else {
            console.log("❌ Fine not paid.");
            showMenu();
        }
    });
}

// Pay individual fines
function payIndividualFine(fines) {
    if (fines.length === 0) {
        console.log("✅ No pending fines.");
        showMenu();
        return;
    }

    console.log("\n📌 Pending Fines:");
    console.log("--------------------------------------");
    console.log("Fine ID | Fine Amount | Book Title");
    console.log("--------------------------------------");

    fines.forEach(fine => {
        console.log(`${fine.fine_due_id}     | ₹${fine.fine_amount}   | ${fine.book_title}`);
    });

    console.log("--------------------------------------");

    rl.question("\nEnter Fine ID(s) to pay (comma separated): ", fineIds => {
        const selectedFineIds = fineIds.split(',').map(id => id.trim());
        payFine(selectedFineIds);
    });
}


// Pay fine (total or selected)
function payFine(selectedFineIds) {
    const payload = selectedFineIds ? { userId, fineIds: selectedFineIds } : { userId };

    axios.post(`${serverUrl}/user/pay-fine`, payload)
        .then(response => {
            console.log(`✔️ ${response.data.message}`);
            showMenu();
        })
        .catch(error => {
            console.error(`⚠️  ${error.response?.data?.error || error.message}`);
            showMenu();
        });
}


function getRecommendations() {
    if (!userId) {
        console.log("❌ You need to be logged in to get recommendations.");
        showMenu();
        return;
    }

    axios.post(`${serverUrl}/user/recommendations`, null, { params: { userId } })
        .then(response => {
            const { collaborative, categoryBased } = response.data;

            // Collaborative Recommendations
            console.log("\n📚 Collaborative Recommendations:");
            if (collaborative.length === 0) {
                console.log("No collaborative recommendations found yet. Like more books to improve suggestions!");
            } else {
                collaborative.forEach((book, index) => {
                    console.log(`${index + 1}. ${book.book_title}`);  // Add 1 to index for proper numbering
                });
            }
            
            // Category-Based Recommendations
            console.log("\n📚 Category-Based Recommendations:");
            if (categoryBased.length === 0) {
                console.log("No category-based recommendations found yet. Like more books to improve suggestions!");
            } else {
                categoryBased.forEach((book, index) => {
                    console.log(`${index + 1}. ${book.book_title}`);  // Add 1 to index for proper numbering
                });
            }
            
            showMenu();
        })
        .catch(error => {
            console.error("❌ Error fetching recommendations:", error.message);
            showMenu();
        });
}

function getMostLikedBooks() {
    axios.get(`${serverUrl}/book/most-liked`)
        .then(response => {
            const books = response.data;

            if (books.length === 0) {
                console.log("📉 No liked books found.");
            } else {
                console.log("\n🔥 Top 5 Most Liked Books:");
                books.forEach((book, index) => {
                    console.log(`${index + 1}. ${book.book_title} by ${book.authors} of category ${book.category_name} (Book ID ${book.book_id})`);
                });
            }

            return userId ? showMenu() : searchBookMenu();
        })
        .catch(error => {
            console.error("⚠️ Error fetching most liked books:", error.message);
            return userId ? showMenu() : searchBookMenu();
        });
}

// Phirse shuru
showAuthMenu();
