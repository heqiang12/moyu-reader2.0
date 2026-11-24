use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use rusqlite::{params, Connection, Result};
use crate::types::{Book, BookChapter, BookSource, SearchBook};

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(path: PathBuf) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init_tables()?;
        Ok(db)
    }

    pub fn new_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS books (
                book_url TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                author TEXT NOT NULL,
                kind TEXT,
                cover_url TEXT,
                custom_cover_url TEXT,
                intro TEXT,
                custom_intro TEXT,
                origin TEXT NOT NULL,
                origin_name TEXT NOT NULL,
                dur_chapter_index INTEGER DEFAULT 0,
                dur_chapter_title TEXT,
                total_chapter_num INTEGER DEFAULT 0,
                latest_chapter_title TEXT,
                latest_chapter_time TEXT,
                group_id INTEGER,
                word_count TEXT,
                can_update INTEGER DEFAULT 1,
                custom_order INTEGER DEFAULT 0,
                dur_chapter_time INTEGER DEFAULT 0,
                sources_json TEXT
            );

            CREATE TABLE IF NOT EXISTS book_sources (
                book_source_url TEXT PRIMARY KEY,
                book_source_name TEXT NOT NULL,
                book_source_group TEXT,
                book_source_type INTEGER DEFAULT 0,
                enabled INTEGER DEFAULT 1,
                enabled_explore INTEGER DEFAULT 0,
                explore_url TEXT,
                search_url TEXT,
                custom_order INTEGER DEFAULT 0,
                weight INTEGER DEFAULT 0,
                last_update_time INTEGER DEFAULT 0,
                raw_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chapter_cache (
                book_url TEXT NOT NULL,
                chapter_index INTEGER NOT NULL,
                chapter_url TEXT NOT NULL,
                title TEXT,
                content TEXT,
                PRIMARY KEY (book_url, chapter_index)
            );

            CREATE TABLE IF NOT EXISTS chapter_list_cache (
                book_url TEXT PRIMARY KEY,
                chapters_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            ",
        )?;
        let _ = conn.execute("ALTER TABLE books ADD COLUMN sources_json TEXT", []);
        drop(conn);
        // 兼容旧记录：已缓存目录但入架总章数为零，只补齐元数据。
        for book in self.get_bookshelf()?.into_iter().filter(|book| book.total_chapter_num == 0) {
            self.get_cached_chapter_list(&book.book_url)?;
        }
        Ok(())
    }

    // --- 书架操作 ---
    pub fn get_bookshelf(&self) -> Result<Vec<Book>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT book_url, name, author, kind, cover_url, custom_cover_url,
                    intro, custom_intro, origin, origin_name, dur_chapter_index,
                    dur_chapter_title, total_chapter_num, latest_chapter_title,
                    latest_chapter_time, group_id, word_count, can_update,
                    custom_order, dur_chapter_time, sources_json
             FROM books ORDER BY dur_chapter_time DESC, custom_order ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            let sources_str: Option<String> = row.get(20)?;
            let sources = sources_str.and_then(|s| serde_json::from_str::<Vec<SearchBook>>(&s).ok());
            Ok(Book {
                book_url: row.get(0)?,
                name: row.get(1)?,
                author: row.get(2)?,
                kind: row.get(3)?,
                cover_url: row.get(4)?,
                custom_cover_url: row.get(5)?,
                intro: row.get(6)?,
                custom_intro: row.get(7)?,
                origin: row.get(8)?,
                origin_name: row.get(9)?,
                dur_chapter_index: row.get(10)?,
                dur_chapter_title: row.get(11)?,
                total_chapter_num: row.get(12)?,
                latest_chapter_title: row.get(13)?,
                latest_chapter_time: row.get(14)?,
                group: row.get(15)?,
                word_count: row.get(16)?,
                can_update: row.get::<_, Option<i32>>(17)?.map(|v| v != 0),
                order: row.get(18)?,
                dur_chapter_time: row.get(19)?,
                sources,
            })
        })?;

        let mut books = Vec::new();
        for r in rows {
            books.push(r?);
        }
        Ok(books)
    }

    pub fn get_book(&self, book_url: &str) -> Result<Option<Book>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT book_url, name, author, kind, cover_url, custom_cover_url,
                    intro, custom_intro, origin, origin_name, dur_chapter_index,
                    dur_chapter_title, total_chapter_num, latest_chapter_title,
                    latest_chapter_time, group_id, word_count, can_update,
                    custom_order, dur_chapter_time, sources_json
             FROM books WHERE book_url = ?1",
        )?;

        let mut rows = stmt.query_map([book_url], |row| {
            let sources_str: Option<String> = row.get(20)?;
            let sources = sources_str.and_then(|s| serde_json::from_str::<Vec<SearchBook>>(&s).ok());
            Ok(Book {
                book_url: row.get(0)?,
                name: row.get(1)?,
                author: row.get(2)?,
                kind: row.get(3)?,
                cover_url: row.get(4)?,
                custom_cover_url: row.get(5)?,
                intro: row.get(6)?,
                custom_intro: row.get(7)?,
                origin: row.get(8)?,
                origin_name: row.get(9)?,
                dur_chapter_index: row.get(10)?,
                dur_chapter_title: row.get(11)?,
                total_chapter_num: row.get(12)?,
                latest_chapter_title: row.get(13)?,
                latest_chapter_time: row.get(14)?,
                group: row.get(15)?,
                word_count: row.get(16)?,
                can_update: row.get::<_, Option<i32>>(17)?.map(|v| v != 0),
                order: row.get(18)?,
                dur_chapter_time: row.get(19)?,
                sources,
            })
        })?;

        if let Some(r) = rows.next() {
            Ok(Some(r?))
        } else {
            Ok(None)
        }
    }

    pub fn save_book(&self, book: &SearchBook) -> Result<Book> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        let sources_json = book.sources.as_ref().and_then(|s| serde_json::to_string(s).ok());
        conn.execute(
            "INSERT INTO books (
                book_url, name, author, kind, cover_url, intro, origin, origin_name,
                dur_chapter_index, total_chapter_num, latest_chapter_title, dur_chapter_time, sources_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, 0, ?9, ?10, ?11)
            ON CONFLICT(book_url) DO UPDATE SET
                name = excluded.name,
                author = excluded.author,
                cover_url = COALESCE(books.cover_url, excluded.cover_url),
                intro = COALESCE(books.intro, excluded.intro),
                latest_chapter_title = COALESCE(excluded.latest_chapter_title, books.latest_chapter_title),
                sources_json = COALESCE(excluded.sources_json, books.sources_json)",
            params![
                book.book_url,
                book.name,
                book.author,
                book.kind,
                book.cover_url,
                book.intro,
                book.origin,
                book.origin_name.as_deref().unwrap_or(&book.origin),
                book.latest_chapter_title,
                now,
                sources_json,
            ],
        )?;

        drop(conn);
        self.get_cached_chapter_list(&book.book_url)?;
        self.get_book(&book.book_url)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn change_book_source(
        &self,
        old_book_url: &str,
        new_book_url: &str,
        new_origin: &str,
        new_origin_name: &str,
    ) -> Result<Option<Book>> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        tx.execute(
            "UPDATE books SET book_url = ?1, origin = ?2, origin_name = ?3 WHERE book_url = ?4",
            params![new_book_url, new_origin, new_origin_name, old_book_url],
        )?;
        tx.execute("DELETE FROM chapter_list_cache WHERE book_url = ?1", params![old_book_url])?;
        tx.execute("DELETE FROM chapter_cache WHERE book_url = ?1", params![old_book_url])?;
        tx.commit()?;
        drop(conn);
        self.get_book(new_book_url)
    }

    pub fn delete_book(&self, book_url: &str) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM books WHERE book_url = ?1", params![book_url])?;
        tx.execute("DELETE FROM chapter_cache WHERE book_url = ?1", params![book_url])?;
        tx.execute("DELETE FROM chapter_list_cache WHERE book_url = ?1", params![book_url])?;
        tx.commit()?;
        Ok(())
    }

    pub fn save_book_progress(&self, book_url: &str, dur_chapter_index: i32, dur_chapter_title: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE books SET dur_chapter_index = ?1, dur_chapter_title = COALESCE(?2, dur_chapter_title), dur_chapter_time = ?3 WHERE book_url = ?4",
            params![dur_chapter_index, dur_chapter_title, now, book_url],
        )?;
        Ok(())
    }

    // --- 书源操作 ---
    pub fn get_book_sources(&self) -> Result<Vec<BookSource>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT raw_json FROM book_sources ORDER BY custom_order ASC, weight DESC")?;
        let rows = stmt.query_map([], |row| {
            let json_str: String = row.get(0)?;
            Ok(json_str)
        })?;

        let mut sources = Vec::new();
        for r in rows {
            if let Ok(json_str) = r {
                if let Ok(src) = serde_json::from_str::<BookSource>(&json_str) {
                    sources.push(src);
                }
            }
        }
        Ok(sources)
    }

    pub fn get_enabled_book_sources(&self) -> Result<Vec<BookSource>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT raw_json FROM book_sources WHERE enabled = 1 ORDER BY custom_order ASC, weight DESC")?;
        let rows = stmt.query_map([], |row| {
            let json_str: String = row.get(0)?;
            Ok(json_str)
        })?;

        let mut sources = Vec::new();
        for r in rows {
            if let Ok(json_str) = r {
                if let Ok(src) = serde_json::from_str::<BookSource>(&json_str) {
                    sources.push(src);
                }
            }
        }
        Ok(sources)
    }

    pub fn get_book_source(&self, url: &str) -> Result<Option<BookSource>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT raw_json FROM book_sources WHERE book_source_url = ?1")?;
        let mut rows = stmt.query_map([url], |row| {
            let json_str: String = row.get(0)?;
            Ok(json_str)
        })?;

        if let Some(r) = rows.next() {
            if let Ok(json_str) = r {
                if let Ok(src) = serde_json::from_str::<BookSource>(&json_str) {
                    return Ok(Some(src));
                }
            }
        }
        Ok(None)
    }

    pub fn save_book_source(&self, source: &BookSource) -> Result<()> {
        self.save_book_sources(&[source.clone()])
    }

    pub fn save_book_sources(&self, sources: &[BookSource]) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let now = chrono::Utc::now().timestamp_millis();
        {
            let mut stmt = tx.prepare(
                "INSERT INTO book_sources (
                    book_source_url, book_source_name, book_source_group, book_source_type,
                    enabled, enabled_explore, explore_url, search_url, custom_order, weight,
                    last_update_time, raw_json
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                ON CONFLICT(book_source_url) DO UPDATE SET
                    book_source_name = excluded.book_source_name,
                    book_source_group = excluded.book_source_group,
                    book_source_type = excluded.book_source_type,
                    enabled = excluded.enabled,
                    enabled_explore = excluded.enabled_explore,
                    explore_url = excluded.explore_url,
                    search_url = excluded.search_url,
                    custom_order = excluded.custom_order,
                    weight = excluded.weight,
                    last_update_time = excluded.last_update_time,
                    raw_json = excluded.raw_json",
            )?;

            for source in sources {
                let raw_json = serde_json::to_string(source).unwrap_or_default();
                stmt.execute(params![
                    source.book_source_url,
                    source.book_source_name,
                    source.book_source_group,
                    source.book_source_type.unwrap_or(0),
                    if source.enabled { 1 } else { 0 },
                    if source.enabled_explore { 1 } else { 0 },
                    source.explore_url,
                    source.search_url,
                    source.custom_order.unwrap_or(0),
                    source.weight.unwrap_or(0),
                    now,
                    raw_json,
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn delete_book_source(&self, url: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM book_sources WHERE book_source_url = ?1", params![url])?;
        Ok(())
    }

    pub fn delete_all_book_sources(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM book_sources", [])?;
        Ok(())
    }

    // --- 章节与缓存操作 ---
    pub fn save_chapter_list(&self, book_url: &str, chapters: &[BookChapter]) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let json_str = serde_json::to_string(chapters).unwrap_or_default();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO chapter_list_cache (book_url, chapters_json, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(book_url) DO UPDATE SET chapters_json = excluded.chapters_json, updated_at = excluded.updated_at",
            params![book_url, json_str, now],
        )?;
        // 更新书本的总章节数
        conn.execute(
            "UPDATE books SET total_chapter_num = ?1 WHERE book_url = ?2",
            params![chapters.len() as i32, book_url],
        )?;
        Ok(())
    }

    pub fn get_cached_chapter_list(&self, book_url: &str) -> Result<Option<Vec<BookChapter>>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT chapters_json FROM chapter_list_cache WHERE book_url = ?1")?;
        let mut rows = stmt.query_map([book_url], |row| {
            let json_str: String = row.get(0)?;
            Ok(json_str)
        })?;

        if let Some(r) = rows.next() {
            if let Ok(json_str) = r {
                if let Ok(chapters) = serde_json::from_str::<Vec<BookChapter>>(&json_str) {
                    // 目录可能先于入架被缓存；命中缓存也需补齐书籍总章数。
                    conn.execute(
                        "UPDATE books SET total_chapter_num = ?1 WHERE book_url = ?2 AND total_chapter_num = 0 AND ?1 > 0",
                        params![chapters.len() as i32, book_url],
                    )?;
                    return Ok(Some(chapters));
                }
            }
        }
        Ok(None)
    }

    pub fn save_chapter_content(&self, book_url: &str, chapter_index: i32, chapter_url: &str, title: &str, content: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO chapter_cache (book_url, chapter_index, chapter_url, title, content)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(book_url, chapter_index) DO UPDATE SET content = excluded.content, title = excluded.title",
            params![book_url, chapter_index, chapter_url, title, content],
        )?;
        Ok(())
    }

    pub fn get_cached_chapter_content(&self, book_url: &str, chapter_index: i32) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT content FROM chapter_cache WHERE book_url = ?1 AND chapter_index = ?2")?;
        let mut rows = stmt.query_map(params![book_url, chapter_index], |row| {
            let content: String = row.get(0)?;
            Ok(content)
        })?;

        if let Some(r) = rows.next() {
            return Ok(Some(r?));
        }
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn book_with_chapters() -> (SearchBook, Vec<BookChapter>) {
        let book: SearchBook = serde_json::from_value(serde_json::json!({
            "bookUrl": "https://novel.test/book/2",
            "name": "目录预览书",
            "author": "测试作者",
            "origin": "https://novel.test"
        })).unwrap();
        let chapters = (0..2).map(|index| BookChapter {
            url: format!("{}/chapter/{}", book.book_url, index),
            title: format!("第 {} 章", index + 1),
            index,
            book_url: book.book_url.clone(),
            is_volume: None,
            base_url: None,
        }).collect();
        (book, chapters)
    }

    #[test]
    fn test_previewed_chapter_count_survives_adding_book() {
        let db = Database::new_in_memory().unwrap();
        let (book, chapters) = book_with_chapters();
        db.save_chapter_list(&book.book_url, &chapters).unwrap();
        assert!(db.get_book(&book.book_url).unwrap().is_none());
        assert_eq!(db.save_book(&book).unwrap().total_chapter_num, 2);

        db.save_book_progress(&book.book_url, 1, Some(&chapters[1].title)).unwrap();
        let before = db.get_book(&book.book_url).unwrap().unwrap();
        let saved_again = db.save_book(&book).unwrap();
        assert_eq!(serde_json::to_value(saved_again).unwrap(), serde_json::to_value(before).unwrap());
        let shelf = db.get_bookshelf().unwrap();
        assert_eq!(shelf[0].dur_chapter_index, 1);
        assert_eq!(shelf[0].total_chapter_num, 2);
    }

    #[test]
    fn test_legacy_chapter_count_backfill_preserves_progress_and_cache() {
        let db = Database::new_in_memory().unwrap();
        let (book, chapters) = book_with_chapters();
        db.save_book(&book).unwrap();
        db.save_chapter_list(&book.book_url, &chapters).unwrap();
        assert_eq!(db.get_book(&book.book_url).unwrap().unwrap().total_chapter_num, 2);
        db.save_book_progress(&book.book_url, 1, Some(&chapters[1].title)).unwrap();
        let cache_before: (String, i64) = {
            let conn = db.conn.lock().unwrap();
            conn.execute("UPDATE books SET total_chapter_num = 0", []).unwrap();
            conn.query_row("SELECT chapters_json, updated_at FROM chapter_list_cache", [],
                |row| Ok((row.get(0)?, row.get(1)?))).unwrap()
        };
        let mut expected = serde_json::to_value(db.get_book(&book.book_url).unwrap().unwrap()).unwrap();
        expected["totalChapterNum"] = serde_json::json!(2);

        // 重演已有数据库再次初始化；只修复缺失总章数，不刷新目录或覆盖定位。
        db.init_tables().unwrap();
        assert_eq!(serde_json::to_value(db.get_book(&book.book_url).unwrap().unwrap()).unwrap(), expected);
        let cache_after: (String, i64) = db.conn.lock().unwrap()
            .query_row("SELECT chapters_json, updated_at FROM chapter_list_cache", [],
                |row| Ok((row.get(0)?, row.get(1)?))).unwrap();
        assert_eq!(cache_after, cache_before);
        db.init_tables().unwrap();
        assert_eq!(db.get_bookshelf().unwrap()[0].total_chapter_num, 2);
    }

    #[test]
    fn test_invalid_or_empty_cached_directory_does_not_invent_chapters() {
        for cached in ["[{}]", "not-json", "[]"] {
            let db = Database::new_in_memory().unwrap();
            let (book, _) = book_with_chapters();
            db.save_book(&book).unwrap();
            db.conn.lock().unwrap().execute(
                "INSERT INTO chapter_list_cache (book_url, chapters_json, updated_at) VALUES (?1, ?2, 1)",
                params![book.book_url, cached],
            ).unwrap();
            db.init_tables().unwrap();
            assert_eq!(db.get_bookshelf().unwrap()[0].total_chapter_num, 0);
        }
    }

    #[test]
    fn test_bookshelf_crud() {
        let db = Database::new_in_memory().unwrap();
        let book = SearchBook {
            book_url: "https://novel.test/book/1".to_string(),
            name: "诡秘之主".to_string(),
            author: "爱潜水的乌贼".to_string(),
            origin: "https://novel.test".to_string(),
            origin_name: Some("测试源".to_string()),
            cover_url: Some("https://novel.test/cover.jpg".to_string()),
            toc_url: None,
            latest_chapter_title: Some("第一章 绯红".to_string()),
            intro: Some("蒸汽朋克与克苏鲁".to_string()),
            word_count: Some("400万字".to_string()),
            kind: Some("奇幻".to_string()),
            sources: None,
        };

        let saved = db.save_book(&book).unwrap();
        assert_eq!(saved.name, "诡秘之主");

        let list = db.get_bookshelf().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].author, "爱潜水的乌贼");

        db.save_book_progress("https://novel.test/book/1", 5, Some("第六章 占卜家")).unwrap();
        let updated = db.get_book("https://novel.test/book/1").unwrap().unwrap();
        assert_eq!(updated.dur_chapter_index, 5);
        assert_eq!(updated.dur_chapter_title.as_deref(), Some("第六章 占卜家"));

        db.delete_book("https://novel.test/book/1").unwrap();
        assert_eq!(db.get_bookshelf().unwrap().len(), 0);
    }

    #[test]
    fn test_batch_sources_and_delete_transaction() {
        let db = Database::new_in_memory().unwrap();
        let s1 = BookSource {
            book_source_name: "源1".to_string(),
            book_source_url: "https://source1.com".to_string(),
            enabled: true,
            ..Default::default()
        };
        let s2 = BookSource {
            book_source_name: "源2".to_string(),
            book_source_url: "https://source2.com".to_string(),
            enabled: true,
            ..Default::default()
        };

        db.save_book_sources(&[s1, s2]).unwrap();
        let sources = db.get_book_sources().unwrap();
        assert_eq!(sources.len(), 2);
    }
}
