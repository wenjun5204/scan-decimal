{
    "name": "ast-safety-checker",
        "version": "1.0.0",
            "description": "AST-based safety checker for math utility functions",
                "main": "ast-safety-checker.js",
                    "scripts": {
        "check": "node ast-safety-checker.js ../src",
            "install-deps": "npm install @babel/parser @babel/traverse glob"
    },
    "dependencies": {
        "@babel/parser": "^7.28.0",
            "@babel/traverse": "^7.28.0",
                "glob": "^8.1.0"
    }
}
