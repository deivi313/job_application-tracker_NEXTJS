CREATE TABLE IF NOT EXISTS boards (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_boards_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS board_columns (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  board_id CHAR(36) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_board_columns_board_id (board_id),
  CONSTRAINT fk_board_columns_board FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_applications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL,
  location VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'applied',
  column_id CHAR(36) NOT NULL,
  board_id CHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  salary VARCHAR(255) NULL,
  job_url VARCHAR(2048) NULL,
  applied_date DATETIME(3) NULL,
  tags JSON NULL,
  description TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_job_applications_column_id (column_id),
  INDEX idx_job_applications_board_id (board_id),
  INDEX idx_job_applications_user_id (user_id),
  CONSTRAINT fk_job_applications_column FOREIGN KEY (column_id) REFERENCES board_columns (id) ON DELETE CASCADE,
  CONSTRAINT fk_job_applications_board FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
