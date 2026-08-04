# Git Commands to Push to GitHub

## Initial Setup (if not already done)

```bash
# Navigate to project root
cd "c:\Users\bonni\Music\nize test"

# Initialize git (if not already initialized)
git init

# Add remote repository
git remote add origin https://github.com/Ayibadiepreye/nize-logistics.git

# Or if remote already exists, update it
git remote set-url origin https://github.com/Ayibadiepreye/nize-logistics.git
```

## Push to GitHub

```bash
# Check current status
git status

# Add all files
git add .

# Commit with message
git commit -m "Complete logistics platform with modern UI and deployment configs"

# Push to main branch
git push -u origin main

# If main branch doesn't exist, try master
git push -u origin master

# Or create and push to main
git branch -M main
git push -u origin main
```

## If You Encounter Issues

### Issue: Remote already exists
```bash
git remote remove origin
git remote add origin https://github.com/Ayibadiepreye/nize-logistics.git
```

### Issue: Branch conflicts
```bash
# Force push (use with caution!)
git push -u origin main --force
```

### Issue: Large files
```bash
# Check which files are large
git ls-files | xargs -I {} git ls-tree -r --name-only HEAD {} | xargs du -h | sort -h

# Remove large files from tracking
git rm --cached path/to/large/file
echo "path/to/large/file" >> .gitignore
git commit -m "Remove large file"
```

## After Pushing

1. Go to https://github.com/Ayibadiepreye/nize-logistics
2. Verify all files are uploaded
3. Check that .env files are NOT uploaded (should be in .gitignore)

## Deploy to Vercel

```bash
# Install Vercel CLI (optional)
npm i -g vercel

# Deploy frontend
cd apps/frontend
vercel

# Or use the Vercel dashboard to import from GitHub
```

## Deploy to Render

1. Go to https://dashboard.render.com/
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Follow DEPLOYMENT.md instructions

## Quick Commands

```bash
# Stage all changes
git add .

# Commit
git commit -m "Your commit message"

# Push
git push

# Check remote
git remote -v

# Check branch
git branch

# Check status
git status
```

## Important Notes

- ✅ `.gitignore` file is already created
- ✅ `.env` and `.env.local` files will NOT be pushed (private)
- ✅ `.env.example` files WILL be pushed (safe)
- ✅ `node_modules/` will NOT be pushed
- ✅ `.next/` build folder will NOT be pushed

## Verify Before Pushing

Run this to see what will be pushed:
```bash
git status
git diff
```

Make sure these are NOT in the list:
- ❌ `.env` files with real secrets
- ❌ `node_modules/`
- ❌ `.next/` build folders
- ❌ Database files
