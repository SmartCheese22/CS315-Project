CREATE DATABASE library_management_system;
USE library_management_system;

-- Initialize all the tables.
CREATE TABLE category(
    category_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(255) NOT NULL
);

CREATE TABLE publisher(
    publisher_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    publisher_name VARCHAR(255) NOT NULL,
    publication_language VARCHAR(255) NOT NULL
);

CREATE TABLE location(
    location_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    floor_no INTEGER,
    shelf_no INTEGER
);

CREATE TABLE author(
    author_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    author_name VARCHAR(255) NOT NULL
);

CREATE TABLE book(
    book_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    book_title VARCHAR(255) NOT NULL,
    category_id INTEGER,
    publisher_id INTEGER,
    publication_year INTEGER,
    location_id INTEGER,
    copies_total INTEGER CHECK (copies_total >= 0),
    copies_available INTEGER,
    no_of_likes INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES category(category_id),
    FOREIGN KEY (publisher_id) REFERENCES publisher(publisher_id),
    FOREIGN KEY (location_id) REFERENCES location(location_id)
);

ALTER TABLE book
ADD CONSTRAINT chk_copies_valid
CHECK (copies_available >= 0 AND copies_available <= copies_total);

CREATE TABLE book_author(
    book_id INTEGER,
    author_id INTEGER,
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY (book_id) REFERENCES book(book_id),
    FOREIGN KEY (author_id) REFERENCES author(author_id)
);

CREATE TABLE user(
    user_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    mobile_no VARCHAR(255) UNIQUE NOT NULL,
    total_fine INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE book_request(
    user_id INTEGER,
    book_id INTEGER,
    request_date DATETIME,
    FOREIGN KEY (user_id) REFERENCES user(user_id),
    FOREIGN KEY (book_id) REFERENCES book(book_id)
);

CREATE TABLE book_issue(
    issue_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    user_id INTEGER,
    book_id INTEGER,
    issue_date DATE,
    return_date DATE,
    return_status INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES user(user_id),
    FOREIGN KEY (book_id) REFERENCES book(book_id)
);

CREATE TABLE fine_due(
    fine_due_id INTEGER PRIMARY KEY,
    user_id INTEGER,
    fine_date DATE,
    fine_amount INTEGER,
    FOREIGN KEY (fine_due_id) REFERENCES book_issue(issue_id),
    FOREIGN KEY (user_id) REFERENCES user(user_id)
);

CREATE TABLE manager(
    manager_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    mobile_no VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE book_like (
    user_id INT,
    book_id INT,
    PRIMARY KEY (user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES user(user_id),
    FOREIGN KEY (book_id) REFERENCES book(book_id)
);

CREATE TABLE book_return(
    return_id INTEGER PRIMARY KEY AUTO_INCREMENT,
    user_id INTEGER,
    book_id INTEGER,
    return_date DATE,
    FOREIGN KEY (user_id) REFERENCES user(user_id),
    FOREIGN KEY (book_id) REFERENCES book(book_id)
);

-- Create indexes.
CREATE INDEX idx_book ON book(no_of_likes DESC);
CREATE INDEX idx_book_issue ON book_issue(book_id, user_id);
CREATE INDEX idx_book_category ON book(category_id);
CREATE INDEX idx_bookauthor_bookid ON book_author(book_id);
CREATE INDEX idx_bookauthor_authorid ON book_author(author_id);

-- Create procedures.
-- For recommending books to users based on their likes and categories.
DELIMITER //
CREATE PROCEDURE get_recommendations(IN uid INT)
BEGIN
    -- Collaborative Recommendations
    SELECT DISTINCT b2.book_id, b2.book_title, 'Collaborative' AS recommendation_type
    FROM book_like bl1
    JOIN book_like bl2 ON bl1.user_id = bl2.user_id
    JOIN book b2 ON b2.book_id = bl2.book_id
    WHERE bl1.book_id IN (
        SELECT book_id FROM book_like WHERE user_id = uid
    )
    AND bl2.book_id NOT IN (
        SELECT book_id FROM book_like WHERE user_id = uid
    )
    AND bl1.user_id != uid;

    -- Category-Based Recommendations
    SELECT DISTINCT b2.book_id, b2.book_title, 'Category-Based' AS recommendation_type
    FROM book_like bl
    JOIN book b1 ON bl.book_id = b1.book_id
    JOIN book b2 ON b1.category_id = b2.category_id
    WHERE bl.user_id = uid
    AND b2.book_id NOT IN (
        SELECT book_id FROM book_like WHERE user_id = uid
    );
END;
//
DELIMITER ;

-- For liking a book.
DELIMITER //
CREATE PROCEDURE like_book_if_issued(IN uid INT, IN bid INT)
BEGIN
    IF NOT EXISTS (
        SELECT * FROM book_issue
        WHERE user_id = uid AND book_id = bid
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'User must have issued the book to like it';
    END IF;

    IF EXISTS (
        SELECT * FROM book_like
        WHERE user_id = uid AND book_id = bid
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'User has already liked this book';
    END IF;

    INSERT INTO book_like (user_id, book_id)
    VALUES (uid, bid);
END;
//
DELIMITER ;

-- In the same way, create a procedure for disliking a book.
DELIMITER //
CREATE PROCEDURE dislike_book(IN uid INT, IN bid INT)
BEGIN
    -- check if the user has liked it or not
    IF NOT EXISTS (
        SELECT * FROM book_like
        WHERE user_id = uid AND book_id = bid
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'User must have liked the book to dislike it';
    END IF;

    DELETE FROM book_like
    WHERE user_id = uid AND book_id = bid;
END;
//
DELIMITER ;


-- Create a triggers
-- For filling fines.
DELIMITER //
CREATE TRIGGER check_fine_after_update
AFTER UPDATE ON book_issue
FOR EACH ROW
BEGIN
    DECLARE due_days INT;
    DECLARE fine_amount INT;

    -- Calculate overdue days (only if return_date is after the expected return_date)
    IF NEW.return_date IS NOT NULL AND NEW.return_date > OLD.return_date THEN
        SET due_days = DATEDIFF(NEW.return_date, OLD.return_date);

        -- Assuming fine is 10 per day
        SET fine_amount = due_days * 10;

        -- Insert record into fine_due table
        IF fine_amount > 0 THEN
            INSERT INTO fine_due (fine_due_id, user_id, fine_date, fine_amount)
            VALUES (OLD.issue_id, NEW.user_id, NEW.return_date, fine_amount);
        END IF;
    END IF;
END;
//
DELIMITER ;

-- For updating the number of likes in the book table.
DELIMITER //
CREATE TRIGGER increment_likes
AFTER INSERT ON book_like
FOR EACH ROW
BEGIN
    UPDATE book
    SET no_of_likes = no_of_likes + 1
    WHERE book_id = NEW.book_id;
END;
//
DELIMITER ;

-- For decrementing the number of likes in the book table.
DELIMITER //
CREATE TRIGGER decrement_likes
AFTER DELETE ON book_like
FOR EACH ROW
BEGIN
    UPDATE book
    SET no_of_likes = no_of_likes - 1
    WHERE book_id = OLD.book_id;
END;
//
DELIMITER ;

-- For updating return date.
CREATE TRIGGER set_return_date
BEFORE INSERT ON book_issue
FOR EACH ROW
SET NEW.return_date = DATE_ADD(NEW.issue_date, INTERVAL 14 DAY);


-- Insert sample data
INSERT INTO category (category_name) VALUES ('Fiction'), ('Science'), ('History'), ('Technology'), ('Philosophy'), ('Mathematics'), ('Psychology'), ('Engineering'), ('Medicine'), ('Art'), ('Biography'), ('Politics'), ('Economics'), ('Education'), ('Environment');

INSERT INTO publisher (publisher_name, publication_language) VALUES ('Penguin', 'English'), ('Springer', 'English'), ('Oxford Press', 'English'), ('HarperCollins', 'English'), ('Cambridge University Press', 'English'), ('McGraw Hill', 'English'), ('Pearson', 'English'), ('MIT Press', 'English'), ('Elsevier', 'English'), ('Routledge', 'English'), ('Bloomsbury', 'English'),
('Thames & Hudson', 'English'), ('Vintage', 'English'), ('Hachette', 'English'), ('Basic Books', 'English');

INSERT INTO location (floor_no, shelf_no) VALUES (1, 5), (2, 10), (3, 15), (1, 3), (2, 7), (3, 1), (1, 9), (2, 4), (3, 8), (1, 6), (4, 2), (4, 5), (4, 8), (5, 1), (5, 3);

INSERT INTO author (author_name) VALUES ('J.K. Rowling'), ('Stephen Hawking'), ('Yuval Noah Harari'), ('Isaac Newton'), ('Albert Einstein'), ('Sigmund Freud'), ('Marie Curie'), ('Leonardo da Vinci'), ('Charles Darwin'), ('Carl Sagan'), ('Malcolm Gladwell'), ('Noam Chomsky'), ('Barack Obama'), ('Elon Musk'), ('Jane Austen');

INSERT INTO book (book_title, category_id, publisher_id, publication_year, location_id, copies_total, copies_available) VALUES 
('Harry Potter', 1, 1, 1997, 1, 10, 8),
('A Brief History of Time', 2, 2, 1988, 2, 5, 3),
('Sapiens', 3, 3, 2011, 3, 7, 6),
('Principia Mathematica', 6, 5, 1687, 4, 3, 3),
('Relativity: The Special and General Theory', 2, 5, 1916, 5, 4, 2),
('The Interpretation of Dreams', 7, 6, 1900, 6, 5, 4),
('On the Origin of Species', 3, 7, 1859, 7, 6, 5),
('Cosmos', 2, 8, 1980, 8, 7, 6),
('The Art of War', 10, 9, -500, 9, 4, 4),
('The Double Helix', 8, 10, 1968, 10, 5, 3),
('Outliers', 11, 11, 2008, 11, 6, 5),
('Who Rules the World?', 12, 12, 2016, 12, 4, 4),
('The Audacity of Hope', 11, 13, 2006, 13, 5, 3),
('Tesla: Inventing the Future', 8, 14, 2015, 14, 7, 6),
('Pride and Prejudice', 1, 15, 1813, 15, 10, 9);

INSERT INTO book_author (book_id, author_id) VALUES (1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6), (7, 9), (8, 10), (9, 8), (10, 7), (11, 11), (12, 12), (13, 13), (14, 14), (15, 15);

INSERT INTO user (name, email, password, mobile_no) VALUES 
('Alice', 'alice@example.com', 'password123', '1234567890'),
('Bob', 'bob@example.com', 'securepass', '0987654321'),
('Charlie', 'charlie@example.com', 'charliepass', '1112233445'),
('David', 'david@example.com', 'davidpass', '5566778899'),
('Emma', 'emma@example.com', 'emmapass', '6677889900'),
('Frank', 'frank@example.com', 'frankpass', '1122334455'),
('Grace', 'grace@example.com', 'gracepass', '9988776655'),
('Hank', 'hank@example.com', 'hankpass', '2233445566'),
('Ivy', 'ivy@example.com', 'ivypass', '3344556677'),
('Jack', 'jack@example.com', 'jackpass', '4455667788');

INSERT INTO book_issue (user_id, book_id, issue_date, return_date) VALUES (1, 1, '2025-03-01', '2025-03-10'), (2, 2, '2025-03-05', '2025-03-15'), (3, 4, '2025-03-10', '2025-03-20'), (4, 5, '2025-03-12', '2025-03-22');

INSERT INTO book_request (user_id, book_id, request_date) VALUES (2,4,'2025-03-16'),(4,4,'2025-03-15'),(8,2,'2025-03-20'),(1,2,'2025-03-17');

INSERT INTO manager (name, email, password, mobile_no) VALUES 
('Abc', 'abc_man@example.com', '234', '1234567890');
